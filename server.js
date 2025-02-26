const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require('path');

const app = express();
const port = 3001;

// DeepSeek R1 API 配置
require('dotenv').config();

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

// 配置中间件
app.use(cors());
app.use(express.json());
app.use('/', express.static(path.join(__dirname)));

// 错误处理函数
const handleError = (res, error, status = 500) => {
    console.error('错误:', error);
    if (!res.headersSent) {
        res.status(status).json({
            error: '服务器内部错误',
            message: error.message
        });
    }
};

// 处理流式数据
const handleStreamData = async (reader, res) => {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        console.log('开始处理流式数据');
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('流式数据接收完成');
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // 尝试解析完整的JSON对象
            try {
                const data = JSON.parse(buffer);
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const content = data.choices[0].message.content;
                    console.log('发送内容:', content);
                    res.write(content);
                    buffer = '';
                }
            } catch (e) {
                // 如果解析失败，说明JSON不完整，继续累积数据
                continue;
            }
        }
    } catch (error) {
        console.error('流式数据处理失败:', {
            error: error.message,
            stack: error.stack
        });
        if (!res.headersSent) {
            res.status(500).send('处理响应数据时发生错误');
        }
        throw error;
    }
};

// API调用函数
const callAPI = async (requestData) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        console.log('发送API请求:', {
            url: API_URL,
            method: 'POST',
            requestData: JSON.stringify(requestData)
        });

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
            console.error('API响应错误:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                error: errorText
            });
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }

        console.log('API请求成功:', {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
        });

        // 读取响应内容
        const text = await response.text();
        return text;
    } catch (error) {
        console.error('API调用异常:', error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
};

// API路由
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            throw new Error('消息内容不能为空');
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
        handleError(res, error);
    }
});

// 设置首页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    handleError(res, err);
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});