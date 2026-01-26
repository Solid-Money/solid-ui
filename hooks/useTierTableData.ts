import { useMemo, useCallback } from 'react';

import { TierTableDocument, TierTableMatrixCell, TierTableRow, TierTableColumn } from '@/lib/types';
import { toTitleCase } from '@/lib/utils';

/**
 * Hook to parse and extract data from TierTableDocument matrix structure
 */
export const useTierTableData = (tierTable: TierTableDocument | undefined) => {
  const structure = useMemo(() => {
    if (!tierTable) {
      return {
        headerRow: null,
        labelColumn: null,
        dataColumns: [],
        dataRows: [],
      };
    }

    return {
      headerRow: tierTable.rows[0] || null,
      labelColumn: tierTable.columns[0] || null,
      dataColumns: tierTable.columns.slice(1), // Skip column 0
      dataRows: tierTable.rows.slice(1), // Skip row 0
    };
  }, [tierTable]);

  /**
   * Get tier headers (row 0, columns 1+)
   * Returns array with same length as structure.dataColumns, with null for missing cells
   * to ensure alignment with getTableRows.valueCells
   */
  const getTierHeaders = useMemo((): (TierTableMatrixCell | null)[] => {
    if (!tierTable || !structure.headerRow) return [];

    return structure.dataColumns.map(col => {
      return (
        tierTable.cells.find(c => c.rowId === structure.headerRow!.id && c.columnId === col.id) ||
        null
      );
    });
  }, [tierTable, structure]);

  /**
   * Find column that matches a tier string
   */
  const findColumnByTier = useCallback(
    (tier: string): TierTableColumn | null => {
      if (!tierTable || !structure.headerRow) return null;

      // Normalize tier string for comparison (capitalize first letter)
      const normalizedTier = toTitleCase(tier);
      return (
        structure.dataColumns.find(col => {
          const headerCell = tierTable.cells.find(
            c => c.rowId === structure.headerRow!.id && c.columnId === col.id,
          );
          return headerCell?.title?.toLowerCase() === normalizedTier.toLowerCase();
        }) || null
      );
    },
    [tierTable, structure],
  );

  /**
   * Get cell for a specific row and column
   */
  const getCell = useCallback(
    (rowId: string, columnId: string): TierTableMatrixCell | null => {
      if (!tierTable) return null;
      return tierTable.cells.find(c => c.rowId === rowId && c.columnId === columnId) || null;
    },
    [tierTable],
  );

  /**
   * Get cells for a specific column, filtered by enabled/implemented
   */
  const getColumnCells = useCallback(
    (
      columnId: string,
      filterEnabled: boolean = true,
    ): Array<{ cell: TierTableMatrixCell; row: TierTableRow; rowIndex: number }> => {
      if (!tierTable) return [];

      return structure.dataRows
        .map((row, index) => {
          const cell = getCell(row.id, columnId);
          if (!cell) return null;
          if (filterEnabled && (!cell.enabled || !cell.implemented)) return null;
          return { cell, row, rowIndex: index + 1 }; // +1 because we skipped row 0
        })
        .filter(
          (item): item is { cell: TierTableMatrixCell; row: TierTableRow; rowIndex: number } =>
            item !== null,
        );
    },
    [tierTable, structure, getCell],
  );

  /**
   * Extract first N benefits for a tier
   */
  const getTierBenefits = useCallback(
    (
      tier: string,
      limit: number = 3,
    ): Array<{ image?: string; title: string; description?: string }> => {
      const matchingColumn = findColumnByTier(tier);
      if (!matchingColumn) return [];

      const cells = getColumnCells(matchingColumn.id, true)
        .sort((a, b) => a.rowIndex - b.rowIndex) // Sort by row index to maintain API order
        .slice(0, limit)
        .map(({ cell }) => ({
          image: cell.image,
          title: cell.title,
          description: cell.description,
        }));

      return cells;
    },
    [findColumnByTier, getColumnCells],
  );

  /**
   * Get table rows for comparison table
   */
  const getTableRows = useMemo((): Array<{
    labelCell: TierTableMatrixCell | null;
    valueCells: (TierTableMatrixCell | null)[];
  }> => {
    if (!tierTable || !structure.labelColumn) return [];

    return structure.dataRows.map(row => {
      // Get row label from column 0
      const labelCell = getCell(row.id, structure.labelColumn!.id);

      // Get data cells for this row (columns 1+)
      const valueCells = structure.dataColumns.map(col => {
        const cell = getCell(row.id, col.id);

        // Only include cells where enabled and implemented are true
        if (cell && cell.enabled && cell.implemented) {
          return cell;
        }
        return null;
      });

      return {
        labelCell,
        valueCells,
      };
    });
  }, [tierTable, structure, getCell]);

  /**
   * Get tier info (title and image) for a tier string
   */
  const getTierInfo = useCallback(
    (tier: string): { title: string; image?: string } | null => {
      const matchingColumn = findColumnByTier(tier);
      if (!matchingColumn || !structure.headerRow) return null;

      const headerCell = getCell(structure.headerRow.id, matchingColumn.id);
      if (!headerCell) return null;

      return {
        title: headerCell.title,
        image: headerCell.image,
      };
    },
    [findColumnByTier, structure, getCell],
  );

  return {
    structure,
    getTierHeaders,
    findColumnByTier,
    getCell,
    getColumnCells,
    getTierBenefits,
    getTableRows,
    getTierInfo,
  };
};
