import { useState } from "react";
import { toast } from "sonner";

const useFetch = <TArgs extends unknown[], TResponse>(
  cb: (...args: TArgs) => Promise<TResponse> | TResponse,
) => {
  const [data, setData] = useState<TResponse | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fn = async (...args: TArgs): Promise<TResponse | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const response = await cb(...args);
      setData(response);
      return response;
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error("Something went wrong");
      setError(normalizedError);
      toast.error(normalizedError.message);
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fn, setData };
};

export default useFetch;
