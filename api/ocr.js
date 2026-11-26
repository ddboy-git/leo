// ====== 填你的百度密钥 ======
const BAIDU_AK = 'yIN6CQAYW0v2Um16luLQjcSc';
const BAIDU_SK = 'KrWhROkNLA2SBAlDGBi1SPRnM2m7iOYN';
// ============================

const https = require('https');

// Vercel Serverless 函数标准入口
export default async function handler(req, res) {
    // 跨域头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(200).json({ 
            ok: false, 
            error: '✅ 服务正常！请在字词闯关设置里填此地址（末尾加/api/ocr）。' 
        });
    }

    try {
        const { image } = req.body || {};
        if (!image) return res.status(200).json({ ok: false, error: '没有收到图片' });

        // 1. 获取百度token
        const tokenRes = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_AK}&client_secret=${BAIDU_SK}`);
        const tokenJson = await tokenRes.json();
        if (!tokenJson.access_token) {
            return res.status(200).json({ ok: false, error: '百度密钥错误，请检查API Key/Secret Key' });
        }

        // 2. 调用手写识别
        const ocrRes = await fetch(`https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${tokenJson.access_token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `image=${encodeURIComponent(image)}&recognize_granularity=big`
        });
        const ocrJson = await ocrRes.json();

        if (!ocrJson.words_result) {
            return res.status(200).json({ ok: false, error: '识别失败：' + JSON.stringify(ocrJson).slice(0, 200) });
        }

        // 3. 拼接结果
        const text = ocrJson.words_result.map(w => w.words).join('').replace(/[\s\n]/g, '');
        res.status(200).json({ ok: true, text: text });

    } catch (err) {
        res.status(200).json({ ok: false, error: '服务异常：' + err.message });
    }
}

// Node原生fetch包装（兼容Vercel Node环境）
function fetch(url, options) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const lib = u.protocol === 'https:' ? https : require('http');
        const req = lib.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: options?.method || 'GET',
            headers: options?.headers || {},
            timeout: 12000
        }, (resp) => {
            let d = '';
            resp.on('data', c => d += c);
            resp.on('end', () => resolve({ json: () => JSON.parse(d) }));
        });
        req.on('error', reject);
        if (options?.body) req.write(options.body);
        req.end();
    });
}
