"""
_sequences.py

Classes for setting up naming/numbering sequences for components.
"""

import time
from gremlin_python.process.traversal import Order, P, TextP, T, Direction
from gremlin_python.process.graph_traversal import __, constant

import _global as g
from _exceptions import *
from _base import (strictraise, Edge, Timestamp, Vertex, VertexAttr,
                   _parse_time, authenticated)
from _permissions import Permission, check_permission
from _component_nodes import ComponentType
from _edges import RelationComponentSequence


class ComponentSequence(Vertex):
    """
    A numbering sequence for components.

    For certain components, this sequence will auto-increment when creating
    labels. For other components, this stores the standard label sequence
    from the manufacturer or otherwise. The implementation of such sequence
    will be used to auto-populate the component type when scanned in.
    """

    category: str = "sequence"
    _vertex_attrs: list = [
        VertexAttr("name", str),
        VertexAttr("prefix", str),
        VertexAttr("seq_size", int),
        VertexAttr("component_type", ComponentType,
                   edge_class=RelationComponentSequence),
        VertexAttr("next_seq", int, optional=True, default=1),
    ]
    primary_attr: str = "name"
    name: str = "default"

    def _validate(self, **kwargs):
        return super()._validate(**kwargs)

    def update(self, **kwargs):
        # set the new values client-side
        self.name = kwargs.get('name', self.name)
        self.prefix = kwargs.get('prefix', self.prefix)
        self.seq_size = kwargs.get('seq_size', self.seq_size)
        self.component_type = kwargs.get('component_type', self.component_type)
        self.next_seq = kwargs.get('next_seq', self.next_seq)

        # set the properties on the graph object
        g.t.V(self.id()).property('name', self.name)\
            .property('prefix', self.prefix)\
            .property('seq_size', self.seq_size)\
            .property('next_seq', self.next_seq)

        # remove the old edge to component type
        g.t.V(self.id()).bothE(RelationComponentSequence.category).drop()

        # add the new connection to component type
        g.t.V(self.id()).addE(RelationComponentSequence.category)\
            .from_(__.V(self.component_type.id()))
