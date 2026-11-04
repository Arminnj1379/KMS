import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../shared/lib/api-client';

interface HealthResponse {
  status: string;
  timestamp: string;
}

export const healthKeys = {
  all: ['health'] as const,
  liveness: () => [...healthKeys.all, 'liveness'] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: healthKeys.liveness(),
    queryFn: async (): Promise<HealthResponse> => {
      const { data } = await apiClient.get<HealthResponse>('/health');
      return data;
    },
    retry: false,
  });
}
