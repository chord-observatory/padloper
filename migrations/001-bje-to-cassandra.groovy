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
oldAdminPerms = oldGraph.traversal().V().has('category', 'user_group').has('name', 'admin').values('permissions').count().next()
oldVProps = oldGraph.traversal().V().properties().count().next()
oldEProps = oldGraph.traversal().E().properties().count().next()
oldByCat = oldGraph.traversal().V().groupCount().by('category').next()
println "      BJE graph: vertices=${oldVCount} edges=${oldECount} adminPerms=${oldAdminPerms} vProps=${oldVProps} eProps=${oldEProps} byCategory=${oldByCat}"
println "[1/3] writing GraphSON to ${EXPORT_FILE}"
oldGraph.io(IoCore.graphson()).writeGraph(EXPORT_FILE)
oldGraph.close()
println '[1/3] export complete'

// --- 2. Open Cassandra-backed graph and apply schema -----------------------
println "[2/3] opening Cassandra-backed graph: ${CQL_CONFIG}"
newGraph = JanusGraphFactory.open(CQL_CONFIG)
graph = newGraph

// Apply ONLY the schema half of index_setup.groovy (property keys + edge
// labels + indices) to the empty Cassandra graph BEFORE importing data. This
// is what guarantees LIST-cardinality keys (`permissions`, `values`) exist
// with the correct cardinality; otherwise GraphSON import auto-creates them as
// SINGLE and silently collapses every multi-value list to one element.
//
// We deliberately STRIP the data-seed section (everything from the
// "Seed initial admin user and group" marker on). That section (a) references
// `g`, which isn't bound in a GroovyShell, and (b) would create DUPLICATE
// master user/group vertices on top of the ones arriving via GraphSON import.
// The seed is only for fresh installs and runs in the main service's initdb
// hook, not here.
println "[2/3] reading schema file ${SCHEMA_FILE}"
allLines = new File(SCHEMA_FILE).readLines()
seedIdx = allLines.findIndexOf { it.contains('Seed initial admin user and group') }
schemaCandidate = (seedIdx >= 0 ? allLines[0..<seedIdx] : allLines)
schemaLines = schemaCandidate.findAll { !it.trim().startsWith(':') }
// Prepend imports that the schema script uses but that aren't auto-imported
// outside of a real Gremlin Server context (where these are auto-resolved).
schemaImports = ['import org.janusgraph.core.Cardinality', 'import org.janusgraph.core.schema.SchemaAction', 'import org.apache.tinkerpop.gremlin.structure.Vertex', 'import org.apache.tinkerpop.gremlin.structure.Edge', ''].join('\n')
schemaSrc = schemaImports + schemaLines.join('\n')
println "[2/3] applying schema-only (${schemaLines.size()} lines; data-seed stripped at line ${seedIdx})"
binding = new Binding()
binding.setVariable('graph', newGraph)
shell = new GroovyShell(binding)
// Do NOT swallow schema errors. A half-applied schema is precisely how LIST
// cardinality silently degrades — fail the migration instead so the marker is
// not written and the main service won't start on a corrupt target.
shell.evaluate(schemaSrc)
println '[2/3] schema applied (LIST cardinality for permissions/values now in place)'

// --- 3. Import data --------------------------------------------------------
println "[3/3] importing GraphSON from ${EXPORT_FILE}"
newGraph.io(IoCore.graphson()).readGraph(EXPORT_FILE)
newVCount = newGraph.traversal().V().count().next()
newECount = newGraph.traversal().E().count().next()
newAdminPerms = newGraph.traversal().V().has('category', 'user_group').has('name', 'admin').values('permissions').count().next()
newVProps = newGraph.traversal().V().properties().count().next()
newEProps = newGraph.traversal().E().properties().count().next()
newByCat = newGraph.traversal().V().groupCount().by('category').next()
println "      Cassandra graph after import: vertices=${newVCount} edges=${newECount} adminPerms=${newAdminPerms} vProps=${newVProps} eProps=${newEProps} byCategory=${newByCat}"
newGraph.close()

if (newVCount != oldVCount || newECount != oldECount) { println "ERROR: vertex/edge counts differ (BJE v=${oldVCount} e=${oldECount} -> CQL v=${newVCount} e=${newECount})"; System.exit(2) }
if (newAdminPerms != oldAdminPerms) { println "ERROR: LIST-cardinality data loss: admin 'permissions' entries ${oldAdminPerms} -> ${newAdminPerms} (the 'permissions' key was likely created as SINGLE before import). Aborting."; System.exit(3) }
if (newVProps != oldVProps || newEProps != oldEProps) { println "ERROR: property-count mismatch (vertex props ${oldVProps}->${newVProps}, edge props ${oldEProps}->${newEProps}) — per-property data loss. Aborting."; System.exit(4) }
if (oldByCat != newByCat) { println "ERROR: per-category vertex counts differ: ${oldByCat} -> ${newByCat}. Aborting."; System.exit(5) }
println "      fidelity checks OK: adminPerms=${newAdminPerms} vProps=${newVProps} eProps=${newEProps} byCategory=${newByCat}"

println '=== migration 001 complete ==='
