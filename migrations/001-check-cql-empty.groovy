// Helper: prints "CQL_HAS_DATA" if the Cassandra-backed graph already has
// vertices. Used by 001-bje-to-cassandra.sh to refuse to overwrite a non-empty
// destination.
//
// Top-level vars are bare assignments (no `def`) because gremlin.sh -e
// evaluates statements through groovysh where def-scoped locals don't persist.

import org.janusgraph.core.JanusGraphFactory

CQL_CONFIG = '/opt/janusgraph/conf/janusgraph-cql-es-server.properties'

graph = JanusGraphFactory.open(CQL_CONFIG)
n = graph.traversal().V().limit(1).count().next()
graph.close()

if (n > 0) {
    println 'CQL_HAS_DATA'
}
