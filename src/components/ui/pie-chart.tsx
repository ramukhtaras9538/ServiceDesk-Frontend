import { Circle, Path, Svg } from "react-native-svg";

export interface PieChartSlice {
  label: string;
  value: number;
  color: string;
}

export function PieChart({
  slices,
  size = 184,
}: {
  slices: PieChartSlice[];
  size?: number;
}) {
  const visibleSlices = slices.filter((slice) => slice.value > 0);
  const total = visibleSlices.reduce((sum, slice) => sum + slice.value, 0);
  const center = 100;
  const radius = 94;
  let startAngle = -Math.PI / 2;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {total === 0 ? (
        <Circle cx={center} cy={center} r={radius} fill="#e7ebf3" />
      ) : visibleSlices.length === 1 ? (
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill={visibleSlices[0].color}
        />
      ) : (
        visibleSlices.map((slice) => {
          const endAngle =
            startAngle + (slice.value / total) * Math.PI * 2;
          const startX = center + radius * Math.cos(startAngle);
          const startY = center + radius * Math.sin(startAngle);
          const endX = center + radius * Math.cos(endAngle);
          const endY = center + radius * Math.sin(endAngle);
          const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
          const path = [
            `M ${center} ${center}`,
            `L ${startX} ${startY}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`,
            "Z",
          ].join(" ");
          startAngle = endAngle;
          return <Path key={slice.label} d={path} fill={slice.color} />;
        })
      )}
    </Svg>
  );
}
