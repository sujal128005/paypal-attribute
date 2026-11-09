"use client";

// AG Grid + AG Charts, themed to match the PayPal-inspired design system.
import { forwardRef } from "react";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule as ChartsCommunity, ModuleRegistry as ChartsRegistry, type AgChartOptions } from "ag-charts-community";

ModuleRegistry.registerModules([AllCommunityModule]);
ChartsRegistry.registerModules([ChartsCommunity]);

export const gridTheme = themeQuartz.withParams({
  accentColor: "#0070E0",
  backgroundColor: "#FFFFFF",
  foregroundColor: "#0A0A0A",
  borderColor: "#E3E7EB",
  headerBackgroundColor: "#F6F8FA",
  headerTextColor: "#595959",
  headerFontWeight: 600,
  headerFontSize: 12.5,
  fontFamily: "Inter Variable, Helvetica Neue, Arial, sans-serif",
  fontSize: 14,
  rowHoverColor: "#F0F7FF",
  selectedRowBackgroundColor: "#E6F6FF",
  oddRowBackgroundColor: "#FFFFFF",
  wrapperBorderRadius: 20,
  wrapperBorder: { color: "#E3E7EB" },
  rowBorder: { color: "#EDF0F2" },
  spacing: 8,
  rowHeight: 52,
  headerHeight: 44,
});

export const DataGrid = forwardRef<AgGridReact, AgGridReactProps>(function DataGrid(props, ref) {
  return <AgGridReact ref={ref} theme={gridTheme} animateRows {...props} />;
});

export function Chart({ options, height = 280 }: { options: AgChartOptions; height?: number }) {
  return (
    <div style={{ height }}>
      <AgCharts
        options={{
          background: { visible: false },
          padding: { top: 8, right: 8, bottom: 4, left: 4 },
          theme: {
            baseTheme: "ag-default",
            palette: { fills: ["#0070E0", "#60CDFF", "#002991", "#FFD140", "#5B3FD1", "#0E7C66"], strokes: ["#0070E0", "#60CDFF", "#002991", "#FFD140", "#5B3FD1", "#0E7C66"] },
            params: { fontFamily: "Inter Variable, Helvetica Neue, Arial, sans-serif", fontSize: 12, foregroundColor: "#0A0A0A", subtleTextColor: "#8A8F98" },
          },
          ...options,
        } as AgChartOptions}
      />
    </div>
  );
}
