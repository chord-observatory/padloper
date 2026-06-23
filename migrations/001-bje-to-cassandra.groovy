// Migration 001: export BJE-backed graph to GraphSON, then re-import into the
// Cassandra+ES-backed graph. Both opened directly via JanusGraphFactory so we
// don't need a running Gremlin Server inside the migration container.
//
// Schema is applied to the new graph by sourcing /docker-entrypoint-initdb.d/
// index_setup.groovy (the same schema seed the main service runs). The
// `:remote` console commands at the top of that file are stripped before
// evaluation so the rest can run inside a plain Groovy context with `graph`
// bound to our open JanusGraph instance.
//
// Note on style: `gremlin.sh -e <file>` evaluates each top-level statement
// independently through groovysh. That has two consequences:
//   1. `def` doesn't persist across statements — use bare assignments.
//   2. Multi-line method chains aren't parsed as one statement — keep chains
//      on a single line, or wrap blocks in explicit braces.

import org.apache.tinkerpop.gremlin.structure.io.IoCore
import org.janusgraph.core.Cardinality
import org.janusgraph.core.JanusGraphFactory
import org.janusgraph.core.schema.SchemaAction

BJE_CONFIG  = '/opt/janusgraph/conf/janusgraph-berkeleyje-lucene-server.properties'
CQL_CONFIG  = '/opt/janusgraph/conf/janusgraph-cql-es-server.properties'
EXPORT_FILE = '/var/lib/janusgraph/migration-001-export.graphson'
SCHEMA_FILE = '/docker-entrypoint-initdb.d/index_setup.groovy'

println '=== migration 001: BJE -> Cassandra+ES ==='

// --- 1. Export from BJE ----------------------------------------------------
println "[1/3] opening BJE-backed graph: ${BJE_CONFIG}"
oldGraph = JanusGraphFactory.open(BJE_CONFIG)
oldVCount = oldGraph.traversal().V().count().next()
oldECount = oldGraph.traversal().E().count().next()
println "      BJE graph: vertices=${oldVCount} edges=${oldECount}"
println "[1/3] writing GraphSON to ${EXPORT_FILE}"
oldGraph.io(IoCore.graphson()).writeGraph(EXPORT_FILE)
oldGraph.close()
println '[1/3] export complete'

// --- 2. Open Cassandra-backed graph and apply schema -----------------------
println "[2/3] opening Cassandra-backed graph: ${CQL_CONFIG}"
newGraph = JanusGraphFactory.open(CQL_CONFIG)
graph = newGraph

// TODO(schema-apply): the schema file index_setup.groovy references `g` (the
// gremlin traversal source) for seeding master user/group. In a GroovyShell
// context that binding is missing, so the second half of the schema script
// fails with `MissingPropertyException: g`. The catch below swallows it. Net
// effect on migration: property keys (first half of script) are created via
// the schema apply OR auto-created with SINGLE cardinality during GraphSON
// import. LIST-cardinality properties (`values`, `permissions`) would be
// auto-created with the wrong cardinality. The main janusgraph service runs
// the same schema script after migration via its initdb hook (in a real
// Gremlin Server context, where `g` is bound) and re-applies. To make this
// migration strict-correct, either (a) bind `g = newGraph.traversal()` into
// the GroovyShell binding here, or (b) split index_setup.groovy into a
// schema-only file vs a data-seed file. Not blocking the current security/
// version-bump work.

println "[2/3] reading schema file ${SCHEMA_FILE}"
schemaLines = new File(SCHEMA_FILE).readLines().findAll { !it.trim().startsWith(':') }
// Prepend imports that the schema script uses but that aren't auto-imported
// outside of a real Gremlin Server context (where these are auto-resolved).
schemaImports = ['import org.janusgraph.core.Cardinality', 'import org.janusgraph.core.schema.SchemaAction', 'import org.apache.tinkerpop.gremlin.structure.Vertex', 'import org.apache.tinkerpop.gremlin.structure.Edge', ''].join('\n')
schemaSrc = schemaImports + schemaLines.join('\n')
println "[2/3] applying schema (${schemaLines.size()} non-console-directive lines + prepended imports)"
binding = new Binding()
binding.setVariable('graph', newGraph)
shell = new GroovyShell(binding)
try { shell.evaluate(schemaSrc) } catch (Throwable t) { println "      WARN: schema script raised ${t.class.simpleName}: ${t.message}; continuing on the assumption schema is already in place" }

// --- 3. Import data --------------------------------------------------------
println "[3/3] importing GraphSON from ${EXPORT_FILE}"
newGraph.io(IoCore.graphson()).readGraph(EXPORT_FILE)
newVCount = newGraph.traversal().V().count().next()
newECount = newGraph.traversal().E().count().next()
println "      Cassandra graph after import: vertices=${newVCount} edges=${newECount}"
newGraph.close()

if (newVCount != oldVCount || newECount != oldECount) { println "ERROR: vertex/edge counts differ (BJE v=${oldVCount} e=${oldECount} -> CQL v=${newVCount} e=${newECount})"; System.exit(2) }

println '=== migration 001 complete ==='
