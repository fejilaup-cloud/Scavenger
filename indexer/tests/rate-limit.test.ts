import { RateLimiter } from '../src/rate-limit';
import Redis from 'redis';

describe('RateLimiter', () => {
  let client: Redis.RedisClient;
  let limiter: RateLimiter;

  beforeEach(() => {
    client = Redis.createClient({
      host: 'localhost',
      port: 6379,
    });
    limiter = new RateLimiter(client);

    limiter.registerTier({
      name: 'free',
      limits: {
        '/api/participants': { windowMs: 60000, maxRequests: 10 },
        '/api/waste': { windowMs: 60000, maxRequests: 20 },
      },
    });

    limiter.registerTier({
      name: 'premium',
      limits: {
        '/api/participants': { windowMs: 60000, maxRequests: 100 },
        '/api/waste': { windowMs: 60000, maxRequests: 200 },
      },
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      client.flushdb(() => resolve());
    });
  });

  test('should allow requests within limit', async () => {
    const result = await limiter.checkLimit('user1', '/api/participants', 'free');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(8);
  });

  test('should deny requests exceeding limit', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.checkLimit('user2', '/api/participants', 'free');
    }
    const result = await limiter.checkLimit('user2', '/api/participants', 'free');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should respect different tier limits', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.checkLimit('user3', '/api/participants', 'free');
    }
    const freeResult = await limiter.checkLimit('user3', '/api/participants', 'free');
    expect(freeResult.allowed).toBe(false);

    const premiumResult = await limiter.checkLimit('user3', '/api/participants', 'premium');
    expect(premiumResult.allowed).toBe(true);
  });

  test('should whitelist users', async () => {
    limiter.addToWhitelist('whitelisted-user');
    for (let i = 0; i < 100; i++) {
      const result = await limiter.checkLimit('whitelisted-user', '/api/participants', 'free');
      expect(result.allowed).toBe(true);
    }
  });

  test('should blacklist users', async () => {
    limiter.addToBlacklist('blacklisted-user');
    const result = await limiter.checkLimit('blacklisted-user', '/api/participants', 'free');
    expect(result.allowed).toBe(false);
  });

  test('should return rate limit headers', async () => {
    const headers = await limiter.getRateLimitHeaders('user4', '/api/participants', 'free');
    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('8');
    expect(headers['X-RateLimit-Reset']).toBeDefined();
  });

  test('should reset rate limit for user', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.checkLimit('user5', '/api/participants', 'free');
    }
    let result = await limiter.checkLimit('user5', '/api/participants', 'free');
    expect(result.allowed).toBe(false);

    await limiter.reset('user5', '/api/participants');
    result = await limiter.checkLimit('user5', '/api/participants', 'free');
    expect(result.allowed).toBe(true);
  });

  test('should track different endpoints separately', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.checkLimit('user6', '/api/participants', 'free');
    }
    const participantsResult = await limiter.checkLimit('user6', '/api/participants', 'free');
    expect(participantsResult.allowed).toBe(false);

    const wasteResult = await limiter.checkLimit('user6', '/api/waste', 'free');
    expect(wasteResult.allowed).toBe(true);
  });
});
