import { useQuery } from "@tanstack/react-query";
import { fetchAgents, fetchMeta } from "../api/tickets";

export const useMeta = () =>
  useQuery({ queryKey: ["meta"], queryFn: fetchMeta, staleTime: 10 * 60_000 });
export const useAgents = (enabled: boolean) =>
  useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    enabled,
    staleTime: 5 * 60_000,
  });
