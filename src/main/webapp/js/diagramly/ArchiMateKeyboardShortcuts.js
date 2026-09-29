/**
 * ArchiMate fork keyboard shortcuts for alignment and distribution.
 *
 * Alt+Left/Right/Up/Down aligns the selection to its left, right, top or
 * bottom edge. This replaces the default Alt+Cursor behaviour, which only
 * moved the selection like the plain cursor keys. Alt+Shift+Cursor (connect
 * vertex) is unchanged.
 *
 * Ctrl+Space distributes the selection by equal spacing between edges,
 * Ctrl+Shift+Space by equal distance between centers. Alt+Space is not usable
 * because Windows opens the window menu before the page sees the key.
 * The direction follows the spread of the selection: a row is distributed
 * horizontally, a column vertically.
 *
 * Custom keyboardShortcuts in the configuration still take precedence.
 */
(function()
{
	function isHorizontalSelection(graph)
	{
		var cells = graph.getSelectionCells();
		var minX = null, maxX = null, minY = null, maxY = null;

		for (var i = 0; i < cells.length; i++)
		{
			var state = (graph.model.isVertex(cells[i])) ?
				graph.view.getState(cells[i]) : null;

			if (state != null)
			{
				var cx = state.getCenterX();
				var cy = state.getCenterY();
				minX = (minX != null) ? Math.min(minX, cx) : cx;
				maxX = (maxX != null) ? Math.max(maxX, cx) : cx;
				minY = (minY != null) ? Math.min(minY, cy) : cy;
				maxY = (maxY != null) ? Math.max(maxY, cy) : cy;
			}
		}

		return minX == null || maxX - minX >= maxY - minY;
	};

	var actionsInit = Actions.prototype.init;

	Actions.prototype.init = function()
	{
		actionsInit.apply(this, arguments);

		var graph = this.editorUi.editor.graph;

		this.addAction('distributeCellsAuto', function()
		{
			if (graph.isEnabled())
			{
				graph.distributeCells(isHorizontalSelection(graph));
			}
		}, null, null, Editor.ctrlKey + '+Shift+Space');
		this.addAction('distributeSpacingAuto', function()
		{
			if (graph.isEnabled())
			{
				graph.distributeCells(isHorizontalSelection(graph), null, true);
			}
		}, null, null, Editor.ctrlKey + '+Space');

		this.get('alignCellsLeft').shortcut = 'Alt+Left';
		this.get('alignCellsRight').shortcut = 'Alt+Right';
		this.get('alignCellsTop').shortcut = 'Alt+Up';
		this.get('alignCellsBottom').shortcut = 'Alt+Down';
	};

	// Alt actions are checked before the cursor key handling in
	// EditorUi.createKeyHandler, so these override Alt+Cursor moves
	EditorUi.prototype.altActions[37] = 'alignCellsLeft'; // Alt+Left
	EditorUi.prototype.altActions[38] = 'alignCellsTop'; // Alt+Up
	EditorUi.prototype.altActions[39] = 'alignCellsRight'; // Alt+Right
	EditorUi.prototype.altActions[40] = 'alignCellsBottom'; // Alt+Down

	var editorUiCreateKeyHandler = EditorUi.prototype.createKeyHandler;

	EditorUi.prototype.createKeyHandler = function(editor)
	{
		var keyHandler = editorUiCreateKeyHandler.apply(this, arguments);

		keyHandler.bindAction(32, true, 'distributeSpacingAuto'); // Ctrl+Space
		keyHandler.bindAction(32, true, 'distributeCellsAuto', true); // Ctrl+Shift+Space

		return keyHandler;
	};
})();
