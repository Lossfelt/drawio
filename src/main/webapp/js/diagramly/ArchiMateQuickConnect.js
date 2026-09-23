/**
 * ArchiMate Quick Connect proof of concept.
 *
 * Extends the existing hover connector arrows. When an arrow is dragged from
 * one ArchiMate 4 element to another, the created edge is immediately
 * replaced with a relation chooser. All other connector behaviour remains
 * unchanged.
 *
 * TODO: Filter the relation chooser and shape picker against the ArchiMate 4
 * relationship matrix when semantic validity checking is added.
 */
(function()
{
	var relations = [
		{id: 'aggregation', label: 'Aggregation', style: 'html=1;startArrow=diamondThin;startFill=0;edgeStyle=elbowEdgeStyle;elbow=vertical;startSize=10;endArrow=none;endFill=0;'},
		{id: 'composition', label: 'Composition', style: 'html=1;startArrow=diamondThin;startFill=1;edgeStyle=elbowEdgeStyle;elbow=vertical;startSize=10;endArrow=none;endFill=0;'},
		{id: 'assignment', label: 'Assignment', style: 'endArrow=block;html=1;endFill=1;startArrow=oval;startFill=1;edgeStyle=elbowEdgeStyle;elbow=vertical;'},
		{id: 'realization', label: 'Realization', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=block;elbow=vertical;endFill=0;dashed=1;'},
		{id: 'serving', label: 'Serving', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=open;elbow=vertical;endFill=1;'},
		{id: 'accessUnspecified', label: 'Access (Unspecified)', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=none;elbow=vertical;dashed=1;startFill=0;dashPattern=1 4;'},
		{id: 'access', label: 'Access (Read or Write)', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=open;elbow=vertical;endFill=0;dashed=1;dashPattern=1 4;'},
		{id: 'accessReadWrite', label: 'Access (Read/Write)', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=open;elbow=vertical;endFill=0;dashed=1;startArrow=open;startFill=0;dashPattern=1 4;'},
		{id: 'influence', label: 'Influence', value: '+/-', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=open;elbow=vertical;endFill=0;dashed=1;dashPattern=6 4;'},
		{id: 'association', label: 'Association', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=none;elbow=vertical;'},
		{id: 'directedAssociation', label: 'Association (Directed)', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=openAsync;elbow=vertical;rounded=0;endFill=0;'},
		{id: 'triggering', label: 'Triggering', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=block;dashed=0;elbow=vertical;endFill=1;'},
		{id: 'flow', label: 'Flow', style: 'edgeStyle=elbowEdgeStyle;html=1;endArrow=block;dashed=1;elbow=vertical;endFill=1;dashPattern=6 4;'},
		{id: 'specialization', label: 'Specialization', style: 'endArrow=block;html=1;endFill=0;edgeStyle=elbowEdgeStyle;elbow=vertical;'}
	];

	function getCellStyleValue(graph, cell, key, defaultValue)
	{
		return mxUtils.getValue(graph.getCurrentCellStyle(cell), key, defaultValue);
	};

	function getArchimate4JunctionType(graph, cell)
	{
		if (cell == null || !graph.model.isVertex(cell))
		{
			return null;
		}

		var style = graph.getCurrentCellStyle(cell);
		var junctionType = mxUtils.getValue(style, 'archimate4Junction', null);

		if (junctionType == 'and' || junctionType == 'or')
		{
			return junctionType;
		}

		// Supports junctions created before the explicit marker was added to the
		// ArchiMate 4 palette without treating ordinary ellipses as junctions.
		if (mxUtils.getValue(style, mxConstants.STYLE_SHAPE, '') == 'ellipse' &&
			mxUtils.getValue(style, mxConstants.STYLE_VERTICAL_LABEL_POSITION, '') == 'bottom' &&
			mxUtils.getValue(style, mxConstants.STYLE_LABEL_BACKGROUNDCOLOR, '') == '#ffffff' &&
			mxUtils.getValue(style, mxConstants.STYLE_VERTICAL_ALIGN, '') == 'top')
		{
			var fillColor = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, '');

			return (fillColor == 'strokeColor') ? 'and' :
				(fillColor == '#ffffff') ? 'or' : null;
		}

		return null;
	};

	function isArchimate4Cell(graph, cell)
	{
		if (cell == null || !graph.model.isVertex(cell))
		{
			return false;
		}

		if (getArchimate4JunctionType(graph, cell) != null)
		{
			return false;
		}

		var style = graph.getCurrentCellStyle(cell);
		var shape = mxUtils.getValue(style, mxConstants.STYLE_SHAPE, '');
		var isMarkedArchimate4 = mxUtils.getValue(style, 'archimate4', '0') == '1';
		var fillColor = mxUtils.getValue(style, mxConstants.STYLE_FILLCOLOR, '');
		var isLegacyCompactArchimate4Symbol =
			(fillColor == '#D1BADC' &&
				(shape == 'mxgraph.basic.cloud_callout' || shape == 'ellipse')) ||
			(fillColor == '#BCD9AE' && shape == 'note');

		return shape.indexOf('mxgraph.archimate4.') === 0 || isMarkedArchimate4 ||
			isLegacyCompactArchimate4Symbol;
	};

	function getRelationById(id)
	{
		for (var i = 0; i < relations.length; i++)
		{
			if (relations[i].id == id)
			{
				return relations[i];
			}
		}

		return null;
	};

	function getJunctionRelationState(graph, junction, ignoredEdge)
	{
		var relationId = getCellStyleValue(graph, junction,
			'archimateJunctionRelation', null);
		var edges = graph.model.getEdges(junction) || [];
		var hasUnmanagedEdge = false;

		if (relationId != null && getRelationById(relationId) == null)
		{
			return {status: 'invalid'};
		}

		for (var i = 0; i < edges.length; i++)
		{
			if (edges[i] != ignoredEdge)
			{
				var edgeRelationId = getCellStyleValue(graph, edges[i],
					'archimateRelation', null);

				if (edgeRelationId == null || getRelationById(edgeRelationId) == null)
				{
					hasUnmanagedEdge = true;
				}
				else if (relationId == null)
				{
					relationId = edgeRelationId;
				}
				else if (relationId != edgeRelationId)
				{
					return {status: 'mixed'};
				}
			}
		}

		if (hasUnmanagedEdge)
		{
			return {status: 'unmanaged'};
		}

		return (relationId != null) ? {status: 'known', relation: getRelationById(relationId)} :
			{status: 'empty'};
	};

	function applyArchiMateRelation(graph, edge, relation, junction)
	{
		if (!graph.model.contains(edge))
		{
			return;
		}

		graph.model.beginUpdate();
		try
		{
			graph.model.setStyle(edge, relation.style + 'archimateRelation=' + relation.id + ';');

			if (junction != null && graph.model.contains(junction))
			{
				graph.model.setStyle(junction, mxUtils.setStyle(
					graph.model.getStyle(junction), 'archimateJunctionRelation', relation.id));
			}

			if (relation.value != null)
			{
				graph.cellLabelChanged(edge, relation.value, false);
			}
		}
		finally
		{
			graph.model.endUpdate();
		}

		graph.setSelectionCell(edge);
	};

	function ArchiMateQuickConnectHoverIcons(editorUi)
	{
		this.editorUi = editorUi;
		HoverIcons.call(this, editorUi.editor.graph);
	};

	mxUtils.extend(ArchiMateQuickConnectHoverIcons, HoverIcons);

	ArchiMateQuickConnectHoverIcons.prototype.drag = function(evt, x, y)
	{
		this.graph.archiMateQuickConnectSource = (this.currentState != null) ? this.currentState.cell : null;
		HoverIcons.prototype.drag.apply(this, arguments);
	};

	ArchiMateQuickConnectHoverIcons.prototype.init = function()
	{
		HoverIcons.prototype.init.apply(this, arguments);

		this.graph.connectionHandler.addListener(mxEvent.CONNECT, mxUtils.bind(this, function(sender, evt)
		{
			var edge = evt.getProperty('cell');
			var source = this.graph.archiMateQuickConnectSource;
			var target = evt.getProperty('terminal');
			var sourceJunction = getArchimate4JunctionType(this.graph, source);
			var targetJunction = getArchimate4JunctionType(this.graph, target);

			this.graph.archiMateQuickConnectSource = null;

			if (edge != null && sourceJunction != null && targetJunction != null)
			{
				window.setTimeout(mxUtils.bind(this, function()
				{
					if (this.graph.model.contains(edge))
					{
						this.graph.removeCells([edge]);
						this.editorUi.showError('Junction-relasjon',
							'Junction til junction støttes ikke i denne versjonen.', 'OK');
					}
				}), 0);
			}
			else if (edge != null && source != null && target != null &&
				(sourceJunction != null || targetJunction != null))
			{
				var junction = (sourceJunction != null) ? source : target;
				var element = (sourceJunction != null) ? target : source;

				if (isArchimate4Cell(this.graph, element))
				{
					window.setTimeout(mxUtils.bind(this, function()
					{
						var state = getJunctionRelationState(this.graph, junction, edge);

						if (state.status == 'empty')
						{
							this.editorUi.showArchiMateQuickConnectDialog(edge, junction);
						}
						else if (state.status == 'known')
						{
							applyArchiMateRelation(this.graph, edge, state.relation, junction);
						}
						else if (this.graph.model.contains(edge))
						{
							this.graph.removeCells([edge]);
							var message = (state.status == 'mixed') ?
								'Junctionen har flere relasjonstyper. Rydd opp i junctionen før du legger til en ny relasjon.' :
								'Junctionen har relasjoner som ikke er opprettet av ArchiMate hurtigkobling. Velg eller merk relasjonstypen manuelt før du fortsetter.';
							this.editorUi.showError('Junction-relasjon', message, 'OK');
						}
					}), 0);
				}
			}
			else if (edge != null && source != null && target != null &&
				isArchimate4Cell(this.graph, source) && isArchimate4Cell(this.graph, target))
			{
				window.setTimeout(mxUtils.bind(this, function()
				{
					this.editorUi.showArchiMateQuickConnectDialog(edge);
				}), 0);
			}
		}));

		this.graph.addListener(mxEvent.CELLS_REMOVED, mxUtils.bind(this, function(sender, evt)
		{
			var cells = evt.getProperty('cells') || [];
			var junctions = [];

			for (var i = 0; i < cells.length; i++)
			{
				if (this.graph.model.isEdge(cells[i]))
				{
					var terminals = [this.graph.model.getTerminal(cells[i], true),
						this.graph.model.getTerminal(cells[i], false)];

					for (var j = 0; j < terminals.length; j++)
					{
						if (getArchimate4JunctionType(this.graph, terminals[j]) != null &&
							junctions.indexOf(terminals[j]) < 0)
						{
							junctions.push(terminals[j]);
						}
					}
				}
			}

			for (var i = 0; i < junctions.length; i++)
			{
				if (this.graph.model.contains(junctions[i]) &&
					this.graph.model.getEdges(junctions[i]).length == 0)
				{
					this.graph.model.setStyle(junctions[i], mxUtils.setStyle(
						this.graph.model.getStyle(junctions[i]), 'archimateJunctionRelation', null));
				}
			}
		}));

		this.graph.connectionHandler.addListener(mxEvent.RESET, mxUtils.bind(this, function()
		{
			this.graph.archiMateQuickConnectSource = null;
		}));
	};

	EditorUi.prototype.showArchiMateQuickConnectDialog = function(edge, junction)
	{
		if (edge == null || !this.editor.graph.model.contains(edge))
		{
			return;
		}

		var graph = this.editor.graph;
		var container = document.createElement('div');
		container.style.padding = '16px';
		container.style.maxWidth = '380px';

		var title = document.createElement('div');
		mxUtils.write(title, 'Velg ArchiMate-relasjon');
		title.style.fontSize = '16px';
		title.style.fontWeight = 'bold';
		title.style.marginBottom = '8px';
		container.appendChild(title);

		var description = document.createElement('div');
		mxUtils.write(description, (junction != null) ?
			'Relasjonstypen brukes automatisk for videre koblinger til denne junctionen.' :
			'Relasjonen lagres som en vanlig draw.io-connector.');
		description.style.marginBottom = '12px';
		description.style.color = '#666';
		container.appendChild(description);

		var relationList = document.createElement('div');
		relationList.style.display = 'grid';
		relationList.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
		relationList.style.gap = '6px';
		relationList.style.maxHeight = '300px';
		relationList.style.overflowY = 'auto';
		container.appendChild(relationList);

		var applyRelation = mxUtils.bind(this, function(relation)
		{
			applyArchiMateRelation(graph, edge, relation, junction);

			this.hideDialog();
		});

		for (var i = 0; i < relations.length; i++)
		{
			(function(relation)
			{
				var button = mxUtils.button(relation.label, function()
				{
					applyRelation(relation);
				});
				button.style.width = '100%';
				button.style.textAlign = 'left';
				relationList.appendChild(button);
			})(relations[i]);
		}

		var footer = document.createElement('div');
		footer.style.marginTop = '14px';
		footer.style.textAlign = 'right';
		var cancel = mxUtils.button(mxResources.get('cancel'), mxUtils.bind(this, function()
		{
			if (graph.model.contains(edge))
			{
				graph.removeCells([edge]);
			}

			this.hideDialog();
		}));
		footer.appendChild(cancel);
		container.appendChild(footer);

		this.showDialog(container, 420, null, true, false);
	};

	function getArchimate4ElementStyle(domain, fillColor, appType, archiType)
	{
		var style = 'html=1;outlineConnect=0;whiteSpace=wrap;fillColor=' + fillColor +
			';shape=mxgraph.archimate4.element;appType=' + appType + ';';

		if (archiType != null)
		{
			style += 'archiType=' + archiType + ';';
		}

		return style + 'archiDomain=' + domain + ';';
	};

	// This is the semantic ArchiMate 4 element set. Common elements occur only
	// once, even though the draw.io sidebar also presents domain-coloured
	// variants. Relationships and Grouping are excluded. The two junctions are
	// included because their first connected relationship defines their type.
	var archimate4ShapePickerEntries = [
		{label: 'Role', common: true, appType: 'role', archiType: 'square'},
		{label: 'Collaboration', common: true, appType: 'collab', archiType: 'square'},
		{label: 'Path', common: true, appType: 'path', archiType: 'square'},
		{label: 'Service', common: true, appType: 'serv', archiType: 'rounded'},
		{label: 'Process', common: true, appType: 'proc', archiType: 'rounded'},
		{label: 'Function', common: true, appType: 'func', archiType: 'rounded'},
		{label: 'Event', common: true, appType: 'event', archiType: 'rounded'},
		{label: 'Location', common: true, appType: 'location', archiType: 'square'},

		{label: 'Stakeholder', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'role', 'oct')},
		{label: 'Driver', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'driver', 'oct')},
		{label: 'Assessment', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'assess', 'oct')},
		{label: 'Goal', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'goal', 'oct')},
		{label: 'Outcome', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'outcome', 'oct')},
		{label: 'Principle', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'principle', 'oct')},
		{label: 'Requirement', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'requirement', 'oct')},
		{label: 'Meaning', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'meaning', 'oct')},
		{label: 'Value', style: getArchimate4ElementStyle('motivation', '#D1BADC', 'amValue', 'oct')},

		{label: 'Resource', style: getArchimate4ElementStyle('strategy', '#EFBD5D', 'resource', 'square')},
		{label: 'Capability', style: getArchimate4ElementStyle('strategy', '#EFBD5D', 'capability', 'rounded')},
		{label: 'Value Stream', style: getArchimate4ElementStyle('strategy', '#EFBD5D', 'valueStream', 'rounded')},
		{label: 'Course of Action', style: getArchimate4ElementStyle('strategy', '#EFBD5D', 'course', 'rounded')},

		{label: 'Business Actor', style: getArchimate4ElementStyle('business', '#EDD779', 'actor', 'square')},
		{label: 'Business Interface', style: getArchimate4ElementStyle('business', '#EDD779', 'interface', 'square')},
		{label: 'Business Object', style: getArchimate4ElementStyle('business', '#EDD779', 'passive', 'square')},
		{label: 'Product', style: getArchimate4ElementStyle('business', '#EDD779', 'product', 'square')},

		{label: 'Application Component', style: getArchimate4ElementStyle('application', '#B0D0D9', 'comp', 'square')},
		{label: 'Application Interface', style: getArchimate4ElementStyle('application', '#B0D0D9', 'interface', 'square')},
		{label: 'Data Object', style: getArchimate4ElementStyle('application', '#B0D0D9', 'passive', 'square')},

		{label: 'Node', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'node', 'square')},
		{label: 'Technology Interface', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'interface', 'square')},
		{label: 'Device', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'device', null)},
		{label: 'System Software', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'sysSw', 'square')},
		{label: 'Equipment', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'equipment', 'square')},
		{label: 'Facility', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'facility', 'square')},
		{label: 'Communication Network', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'netw', 'square')},
		{label: 'Distribution Network', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'distribution', 'square')},
		{label: 'Artifact', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'artifact', 'square')},
		{label: 'Material', style: getArchimate4ElementStyle('technology', '#BCD9AE', 'material', 'square')},

		{label: 'Work Package', style: getArchimate4ElementStyle('implementation', '#F1BBB7', 'workPackage', 'rounded')},
		{label: 'Deliverable', style: getArchimate4ElementStyle('implementation', '#F1BBB7', 'deliverable', null)},
		{label: 'Plateau', style: getArchimate4ElementStyle('implementation', '#F1BBB7', 'plateau', null)},

		{label: 'And Junction', junction: true, value: '', width: 30, height: 30,
			style: 'archimate4Junction=and;ellipse;html=1;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;fillColor=strokeColor;'},
		{label: 'Or Junction', junction: true, value: '', width: 30, height: 30,
			style: 'archimate4Junction=or;ellipse;html=1;verticalLabelPosition=bottom;labelBackgroundColor=#ffffff;verticalAlign=top;fillColor=#ffffff;'}
	];

	var archimate4CoreDomainColors = {
		business: '#EDD779',
		application: '#B0D0D9',
		technology: '#BCD9AE'
	};

	function getCommonElementStyle(graph, source, entry)
	{
		var domain = getCellStyleValue(graph, source, 'archiDomain', 'common');
		var fillColor = archimate4CoreDomainColors[domain];

		if (fillColor == null)
		{
			domain = 'common';
			fillColor = '#E5DFD3';
		}

		return getArchimate4ElementStyle(domain, fillColor, entry.appType, entry.archiType);
	};

	function getArchimate4ShapePickerCells(graph, source, includeJunctions)
	{
		var cells = [];

		for (var i = 0; i < archimate4ShapePickerEntries.length; i++)
		{
			var entry = archimate4ShapePickerEntries[i];

			if (entry.junction === true && !includeJunctions)
			{
				continue;
			}

			var style = entry.common ? getCommonElementStyle(graph, source, entry) : entry.style;
			var value = (entry.value != null) ? entry.value : entry.label;
			var cell = graph.createVertex(null, null, value, 0, 0, entry.width || 150,
				entry.height || 75, style, false);
			cell.shapePickerKeepStyle = true;
			cell.archimate4ShapePicker = true;
			cells.push(cell);
		}

		return cells;
	};

	var getCellsForShapePicker = EditorUi.prototype.getCellsForShapePicker;

	EditorUi.prototype.getCellsForShapePicker = function(cell, hovering, showEdges)
	{
		var graph = this.editor.graph;
		var isJunction = getArchimate4JunctionType(graph, cell) != null;

		if (isArchimate4Cell(graph, cell) || isJunction)
		{
			return getArchimate4ShapePickerCells(graph, cell, !isJunction);
		}

		return getCellsForShapePicker.apply(this, arguments);
	};

	function handleShapePickerConnection(ui, graph, source, target, edge)
	{
		var sourceJunction = getArchimate4JunctionType(graph, source);
		var targetJunction = getArchimate4JunctionType(graph, target);

		if (sourceJunction != null && targetJunction != null)
		{
			graph.removeCells([edge]);
			ui.showError('Junction-relasjon',
				'Junction til junction støttes ikke i denne versjonen.', 'OK');
		}
		else if (sourceJunction != null || targetJunction != null)
		{
			var junction = (sourceJunction != null) ? source : target;
			var element = (sourceJunction != null) ? target : source;

			if (isArchimate4Cell(graph, element))
			{
				var state = getJunctionRelationState(graph, junction, edge);

				if (state.status == 'empty')
				{
					ui.showArchiMateQuickConnectDialog(edge, junction);
				}
				else if (state.status == 'known')
				{
					applyArchiMateRelation(graph, edge, state.relation, junction);
				}
				else
				{
					graph.removeCells([edge]);
					var message = (state.status == 'mixed') ?
						'Junctionen har flere relasjonstyper. Rydd opp i junctionen før du legger til en ny relasjon.' :
						'Junctionen har relasjoner som ikke er opprettet av ArchiMate hurtigkobling. Velg eller merk relasjonstypen manuelt før du fortsetter.';
					ui.showError('Junction-relasjon', message, 'OK');
				}
			}
		}
		else if (isArchimate4Cell(graph, source) && isArchimate4Cell(graph, target))
		{
			ui.showArchiMateQuickConnectDialog(edge);
		}
	};

	// The normal Shape Picker flow creates an edge directly through
	// graph.connectVertex, not through mxConnectionHandler. Observe that new
	// edge and then reuse the existing ArchiMate relation chooser.
	var showShapePicker = EditorUi.prototype.showShapePicker;

	EditorUi.prototype.showShapePicker = function(x, y, source, callback, direction,
		hovering, getInsertLocationFn, showEdges, startEditing, cells, connectEdge)
	{
		var graph = this.editor.graph;

		if (callback != null && (isArchimate4Cell(graph, source) ||
			getArchimate4JunctionType(graph, source) != null))
		{
			var ui = this;
			var originalCallback = callback;
			callback = function(target)
			{
				var insertedEdge = null;
				var listener = function(sender, evt)
				{
					var inserted = evt.getProperty('cells') || [];

					for (var i = 0; i < inserted.length; i++)
					{
						var cell = inserted[i];

						if (graph.model.isEdge(cell) &&
							graph.model.getTerminal(cell, true) == source &&
							graph.model.getTerminal(cell, false) == target)
						{
							insertedEdge = cell;
						}
					}
				};

				graph.addListener('cellsInserted', listener);

				try
				{
					originalCallback(target);
				}
				finally
				{
					graph.removeListener(listener);
				}

				if (insertedEdge != null)
				{
					window.setTimeout(function()
					{
						if (graph.model.contains(insertedEdge))
						{
							handleShapePickerConnection(ui, graph, source, target, insertedEdge);
						}
					}, 0);
				}
			};
		}

		return showShapePicker.call(this, x, y, source, callback, direction, hovering,
			getInsertLocationFn, showEdges, startEditing, cells, connectEdge);
	};

	// Standard hover pickers are deliberately limited to four entries and one
	// column for east/west arrows. For this trial, the ArchiMate picker is a
	// four-column grid containing every element template.
	var createShapePicker = EditorUi.prototype.createShapePicker;

	EditorUi.prototype.createShapePicker = function(x, y, source, callback, direction,
		afterClick, cells, hovering)
	{
		var isArchimate4Picker = hovering && cells != null && cells.length > 0 &&
			cells[0].archimate4ShapePicker === true;

		if (isArchimate4Picker)
		{
			arguments[7] = false;
		}

		var div = createShapePicker.apply(this, arguments);

		if (div != null && isArchimate4Picker)
		{
			div.archimate4ShapePicker = true;
			mxUtils.setPrefixedStyle(div.style, 'transform', '');
		}

		return div;
	};

	var centerShapePicker = EditorUi.prototype.centerShapePicker;

	EditorUi.prototype.centerShapePicker = function(div, rect, x, y, dir)
	{
		if (div == null || !div.archimate4ShapePicker)
		{
			return centerShapePicker.apply(this, arguments);
		}

		var pickerRect = div.getBoundingClientRect();

		if (dir == mxConstants.DIRECTION_NORTH)
		{
			x -= pickerRect.width / 2 - 10;
			y -= pickerRect.height + 6;
		}
		else if (dir == mxConstants.DIRECTION_SOUTH)
		{
			x -= pickerRect.width / 2 - 10;
			y += rect.height + 6;
		}
		else if (dir == mxConstants.DIRECTION_WEST)
		{
			x -= pickerRect.width + 6;
			y -= pickerRect.height / 2 - 10;
		}
		else if (dir == mxConstants.DIRECTION_EAST)
		{
			x += rect.width + 6;
			y -= pickerRect.height / 2 - 10;
		}

		var container = this.editor.graph.container;
		var minX = container.scrollLeft + 22;
		var minY = container.scrollTop + 22;
		var maxX = container.scrollLeft + container.offsetWidth - pickerRect.width - 22;
		var maxY = container.scrollTop + container.offsetHeight - pickerRect.height - 22;
		x = Math.max(minX, Math.min(x, Math.max(minX, maxX)));
		y = Math.max(minY, Math.min(y, Math.max(minY, maxY)));

		div.style.left = x + 'px';
		div.style.top = y + 'px';
	};

	EditorUi.prototype.createHoverIcons = function()
	{
		return new ArchiMateQuickConnectHoverIcons(this);
	};
})();
