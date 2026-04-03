import { NextRequest, NextResponse } from "next/server";

type RateLimitConfig = {
  interval: number; // milliseconds
  maxRequests: number;
};

const defaultConfig: RateLimitConfig = {
  interval: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
};

// Simple in-memory rate limiter (for production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(request: NextRequest, config: Partial<RateLimitConfig> = {}) {
  const { interval, maxRequests } = { ...defaultConfig, ...config };

  // Get identifier (IP address or user ID)
  const identifier =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetTime) {
    // New window
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + interval,
    });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  // Increment count
  record.count++;
  requestCounts.set(identifier, record);

  return {
    success: true,
    remaining: maxRequests - record.count,
  };
}

export function withRateLimit<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  config?: Partial<RateLimitConfig>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const limit = rateLimit(request, config);

    if (!limit.success) {
      const retryAfter = Math.ceil((limit.resetTime! - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
          },
        }
      );
    }

    return handler(request);
  };
}
