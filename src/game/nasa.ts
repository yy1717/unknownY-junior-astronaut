// NASA DONKI integration for unknownY — Junior Astronaut Mission Trainer.
//
// Production path:
// Browser -> /api/nasa/sep -> Vercel Function -> NASA DONKI
// The private NASA_API_KEY stays server-side in Vercel Environment Variables.
//
// Local webpack development does not run Vercel Functions, so if the proxy is
// unavailable the browser falls back to NASA's public DEMO_KEY. DEMO_KEY still
// returns real NASA data; it simply has a much lower rate limit.
//
// A verified historical NASA DONKI SEP event is retained as a final training
// fallback so the educational radiation mission remains playable during an API
// outage or rate-limit event. It is never presented as live data.

const PROXY_SEP_URL = '/api/nasa/sep';
const NASA_DIRECT_SEP_URL = 'https://api.nasa.gov/DONKI/SEP';
const NASA_PUBLIC_DEMO_KEY = 'DEMO_KEY';

const LIVE_CACHE_KEY = 'unknownY_nasa_recent_sep_v2';
const LIVE_CACHE_TTL_MS = 15 * 60 * 1000;

const TRAINING_CACHE_KEY = 'unknownY_nasa_training_sep_v2';
const TRAINING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type SEPEvent = {
    sepID: string;
    eventTime?: string;
    linkedEvents?: unknown[];
    instruments?: unknown[];
    source?: string;
    _unknownYSource?:
        | 'nasa-proxy'
        | 'nasa-demo-direct'
        | 'cached-nasa-historical';
    [key: string]: unknown;
};

type CacheEntry = {
    savedAt: number;
    events: SEPEvent[];
};

// Verified historical NASA DONKI SEP event previously retrieved from the API.
// It is used only as a training fallback; it is never presented as live data.
const HISTORICAL_TRAINING_FALLBACK: SEPEvent[] = [
    {
        sepID: '2026-09-05T15:45:00-SEP-001',
        eventTime: '2026-09-05T15:45:00Z',
        source: 'NASA DONKI historical training event',
        _unknownYSource: 'cached-nasa-historical'
    }
];

function formatDate(date: Date)
{
    return date.toISOString().split('T')[0];
}

function readCache(key: string, maxAgeMs: number): SEPEvent[] | null
{
    try
    {
        const raw = localStorage.getItem(key);

        if (!raw)
        {
            return null;
        }

        const parsed = JSON.parse(raw) as CacheEntry;

        if (
            !parsed ||
            !Array.isArray(parsed.events) ||
            typeof parsed.savedAt !== 'number' ||
            Date.now() - parsed.savedAt > maxAgeMs
        )
        {
            return null;
        }

        return parsed.events;
    }
    catch
    {
        return null;
    }
}

function writeCache(key: string, events: SEPEvent[])
{
    try
    {
        const entry: CacheEntry = {
            savedAt: Date.now(),
            events
        };

        localStorage.setItem(key, JSON.stringify(entry));
    }
    catch
    {
        // Cache is optional; gameplay should continue even if storage is blocked.
    }
}

async function fetchSEPFromProxy(
    startDate: string,
    endDate: string
): Promise<SEPEvent[]>
{
    const params = new URLSearchParams({ startDate, endDate });
    const response = await fetch(`${PROXY_SEP_URL}?${params.toString()}`);

    if (!response.ok)
    {
        throw new Error(`NASA proxy request failed: ${response.status}`);
    }

    const data = await response.json() as SEPEvent[];

    if (!Array.isArray(data))
    {
        throw new Error('NASA proxy returned an unexpected response.');
    }

    return data.map(event => ({
        ...event,
        _unknownYSource: 'nasa-proxy' as const
    }));
}

async function fetchSEPDirectDemo(
    startDate: string,
    endDate: string
): Promise<SEPEvent[]>
{
    const url =
        `${NASA_DIRECT_SEP_URL}` +
        `?startDate=${startDate}` +
        `&endDate=${endDate}` +
        `&api_key=${NASA_PUBLIC_DEMO_KEY}`;

    const response = await fetch(url);

    if (!response.ok)
    {
        throw new Error(`NASA DONKI DEMO_KEY request failed: ${response.status}`);
    }

    const data = await response.json() as SEPEvent[];

    return data.map(event => ({
        ...event,
        _unknownYSource: 'nasa-demo-direct' as const
    }));
}

async function fetchSEP(startDate: string, endDate: string): Promise<SEPEvent[]>
{
    try
    {
        return await fetchSEPFromProxy(startDate, endDate);
    }
    catch (proxyError)
    {
        console.warn(
            'NASA server proxy unavailable; falling back to NASA public DEMO_KEY.',
            proxyError
        );

        return fetchSEPDirectDemo(startDate, endDate);
    }
}

export async function fetchRecentSEPEvents(): Promise<SEPEvent[]>
{
    const cached = readCache(LIVE_CACHE_KEY, LIVE_CACHE_TTL_MS);

    if (cached)
    {
        return cached;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const events = await fetchSEP(
        formatDate(startDate),
        formatDate(endDate)
    );

    writeCache(LIVE_CACHE_KEY, events);

    return events;
}

export async function fetchTrainingSEPEvent(): Promise<SEPEvent[]>
{
    const cached = readCache(TRAINING_CACHE_KEY, TRAINING_CACHE_TTL_MS);

    if (cached && cached.length > 0)
    {
        return cached;
    }

    try
    {
        const events = await fetchSEP('2026-09-05', '2026-09-06');

        if (events.length > 0)
        {
            writeCache(TRAINING_CACHE_KEY, events);
            return events;
        }
    }
    catch (error)
    {
        console.warn(
            'NASA DONKI training request unavailable; using cached NASA historical training event.',
            error
        );
    }

    return HISTORICAL_TRAINING_FALLBACK.map(event => ({ ...event }));
}
