import fetch from 'node-fetch';

// DeepSeek R1 API 配置
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const API_TIMEOUT = 60000; // 60秒超时

// 系统提示词
const SYSTEM_PROMPT = `你是一位专业的 Life Coach，拥有丰富的个人成长和职业发展指导经验。你的目标是：
1. 通过深入的对话理解用户的困惑和需求
2. 提供具体、可行的建议和解决方案
3. 鼓励用户积极思考和行动
4. 帮助用户建立良好的习惯和思维方式
5. 在对话中保持专业、友善和支持的态度`;

// API调用函数
const callAPI = async (requestData) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }

        const text = await response.text();
        return text;
    } catch (error) {
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '方法不允许' });
    }

    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({ error: '消息内容不能为空' });
        }

        // 设置响应头
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');

        // 准备请求数据
        const requestData = {
            model: 'deepseek-r1-250120',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage }
            ],
            stream: false,
            temperature: 0.6
        };

        // 调用API并处理响应
        const responseText = await callAPI(requestData);
        res.send(responseText);

    } catch (error) {
        console.error('错误:', error);
        res.status(500).json({
            error: '服务器内部错误',
            message: error.message
        });
    }
}