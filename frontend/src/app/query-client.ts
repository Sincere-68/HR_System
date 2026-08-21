import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) =>
        !(error instanceof Error && 'status' in error && (error as { status: number }).status < 500) &&
        failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
});
