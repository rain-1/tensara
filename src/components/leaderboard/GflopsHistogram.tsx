import { useMemo } from "react";
import { Box, Heading, Text, Flex, Spinner, useColorModeValue } from "@chakra-ui/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { api } from "~/utils/api";
import { useSession } from "next-auth/react";

interface GflopsHistogramProps {
  gpuType: string;
}

interface HistogramBin {
  range: string;
  count: number;
  minValue: number;
  maxValue: number;
  isUserBin: boolean;
}

export const GflopsHistogram: React.FC<GflopsHistogramProps> = ({
  gpuType,
}) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  const { data: distributionData, isLoading } =
    api.submissions.getGflopsDistribution.useQuery(
      { gpuType },
      {
        staleTime: 300000, // 5 minutes
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      }
    );

  const chartData = useMemo(() => {
    if (!distributionData || distributionData.length === 0) return [];

    const gflopsValues = distributionData.map((d) => d.gflops);
    const userGflops = currentUserId
      ? distributionData.find((d) => d.userId === currentUserId)?.gflops
      : undefined;

    // Calculate histogram bins
    const min = Math.min(...gflopsValues);
    const max = Math.max(...gflopsValues);
    const numBins = Math.min(20, Math.ceil(Math.sqrt(gflopsValues.length)));
    const binWidth = (max - min) / numBins;

    // Create bins
    const bins: HistogramBin[] = [];
    for (let i = 0; i < numBins; i++) {
      const binMin = min + i * binWidth;
      const binMax = binMin + binWidth;
      const count = gflopsValues.filter(
        (v) => v >= binMin && (i === numBins - 1 ? v <= binMax : v < binMax)
      ).length;

      // Check if user's GFLOPS falls in this bin
      const isUserBin =
        userGflops !== undefined &&
        userGflops >= binMin &&
        (i === numBins - 1 ? userGflops <= binMax : userGflops < binMax);

      bins.push({
        range: formatRange(binMin, binMax),
        count,
        minValue: binMin,
        maxValue: binMax,
        isUserBin,
      });
    }

    return bins;
  }, [distributionData, currentUserId]);

  const userPercentile = useMemo(() => {
    if (!distributionData || !currentUserId) return null;

    const userEntry = distributionData.find((d) => d.userId === currentUserId);
    if (!userEntry) return null;

    const totalSubmissions = distributionData.length;
    const betterSubmissions = distributionData.filter(
      (d) => d.gflops > userEntry.gflops
    ).length;

    const percentile = ((totalSubmissions - betterSubmissions) / totalSubmissions) * 100;
    return {
      percentile: percentile.toFixed(1),
      gflops: userEntry.gflops,
    };
  }, [distributionData, currentUserId]);

  const barColor = useColorModeValue("#3182CE", "#63B3ED");
  const userBarColor = useColorModeValue("#DD6B20", "#F6AD55");
  const gridColor = useColorModeValue("#E2E8F0", "#2D3748");
  const textColor = useColorModeValue("#2D3748", "#E2E8F0");

  if (isLoading) {
    return (
      <Box
        p={6}
        bg="brand.secondary"
        borderRadius="md"
        borderWidth={1}
        borderColor="whiteAlpha.200"
      >
        <Flex justify="center" align="center" minH="300px">
          <Spinner size="xl" />
        </Flex>
      </Box>
    );
  }

  if (!distributionData || distributionData.length === 0) {
    return (
      <Box
        p={6}
        bg="brand.secondary"
        borderRadius="md"
        borderWidth={1}
        borderColor="whiteAlpha.200"
      >
        <Heading size="md" mb={4} color="white">
          GFLOPS Distribution
        </Heading>
        <Text color="whiteAlpha.700">
          No submissions with GFLOPS data available for this GPU type.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      p={6}
      bg="brand.secondary"
      borderRadius="md"
      borderWidth={1}
      borderColor="whiteAlpha.200"
      mb={6}
    >
      <Flex direction="column" gap={4}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
          <Heading size="md" color="white">
            GFLOPS Distribution
          </Heading>
          {userPercentile && (
            <Flex direction="column" align="flex-end">
              <Text fontSize="sm" color="orange.300" fontWeight="bold">
                Your Position: {formatPerformance(userPercentile.gflops)}
              </Text>
              <Text fontSize="xs" color="whiteAlpha.700">
                Top {100 - parseFloat(userPercentile.percentile)}% of submissions
              </Text>
            </Flex>
          )}
        </Flex>
        <Text fontSize="sm" color="whiteAlpha.700">
          Distribution of best GFLOPS performance across all submissions (one per
          user-GPU combination). {userPercentile && "Your position is highlighted in orange."}
        </Text>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
            <XAxis
              dataKey="range"
              stroke={textColor}
              tick={{ fill: textColor, fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke={textColor}
              tick={{ fill: textColor, fontSize: 12 }}
              label={{
                value: "Number of Submissions",
                angle: -90,
                position: "insideLeft",
                style: { fill: textColor, fontSize: 14 },
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1A202C",
                border: "1px solid #2D3748",
                borderRadius: "8px",
                color: "#E2E8F0",
              }}
              labelStyle={{ color: "#E2E8F0", fontWeight: "bold" }}
              formatter={(value: number) => [`${value} submissions`, "Count"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isUserBin ? userBarColor : barColor}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Flex>
    </Box>
  );
};

function formatPerformance(gflops: number): string {
  if (gflops >= 1000) {
    const tflops = (gflops / 1000).toFixed(2);
    return `${parseFloat(tflops)} TFLOPS`;
  }
  return `${parseFloat(gflops.toFixed(2))} GFLOPS`;
}

function formatRange(min: number, max: number): string {
  const formatValue = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}T`;
    }
    return `${value.toFixed(0)}G`;
  };
  return `${formatValue(min)}-${formatValue(max)}`;
}
