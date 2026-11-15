const DONKI_SEP_URL = 'https://api.nasa.gov/DONKI/SEP';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sendJson(res, status, data, extraHeaders = {}) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    for (const [name, value] of Object.entries(extraHeaders)) {
        res.setHeader(name, value);
    }

    res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        sendJson(res, 405, { error: 'Method not allowed.' });
        return;
    }

    const requestUrl = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const startDate = requestUrl.searchParams.get('startDate');
    const endDate = requestUrl.searchParams.get('endDate');

    if (!startDate || !endDate || !DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
        sendJson(
            res,
            400,
            { error: 'startDate and endDate are required in YYYY-MM-DD format.' }
        );
        return;
    }

    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start ||
        end.getTime() - start.getTime() > maxRangeMs
    ) {
        sendJson(res, 400, { error: 'Invalid date range. Maximum range is 90 days.' });
        return;
    }

    const apiKey = process.env.NASA_API_KEY;

    if (!apiKey) {
        sendJson(
            res,
            503,
            { error: 'NASA_API_KEY is not configured on the server.' },
            { 'Cache-Control': 'no-store' }
        );
        return;
    }

    const nasaUrl = new URL(DONKI_SEP_URL);
    nasaUrl.searchParams.set('startDate', startDate);
    nasaUrl.searchParams.set('endDate', endDate);
    nasaUrl.searchParams.set('api_key', apiKey);

    try {
        const nasaResponse = await fetch(nasaUrl, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!nasaResponse.ok) {
            const body = await nasaResponse.text();

            sendJson(
                res,
                nasaResponse.status >= 500 ? 502 : nasaResponse.status,
                {
                    error: 'NASA DONKI request failed.',
                    status: nasaResponse.status,
                    details: body.slice(0, 300)
                },
                { 'Cache-Control': 'no-store' }
            );
            return;
        }

        const data = await nasaResponse.json();

        sendJson(
            res,
            200,
            data,
            {
                'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600'
            }
        );
    }
    catch (error) {
        sendJson(
            res,
            502,
            {
                error: 'NASA DONKI request could not be completed.',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { 'Cache-Control': 'no-store' }
        );
    }
};
