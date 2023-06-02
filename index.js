import express from 'express'
import cron from 'node-cron'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fetchSuperioBeers, getAllBeers, generateBeers, mergeAllFiles } from './api/apiHelper.js'
import { cronService } from './api/cronHelper.js'
const PORT = process.env.PORT || 3000;
const FILENAME = './api/generated/all.json'

var corsOptions = {
    origin: '*',
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
cron.schedule("1 * * * *", cronService)
const app = express()
app.use(cors())
app.options('*', cors()) // include before other routes

app.use(express.static('web/build'));
app.set('json spaces', 2)
app.get('/merge', mergeAllFiles)
app.get('/getAllBeers', generateBeers)
app.get('/getsuperior', fetchSuperioBeers)
app.get('/all', cors(corsOptions), getAllBeers)

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'web', 'build', 'index.html'));
});



// SSE endpoint
app.get('/live', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const filePath = path.basename(path.dirname(FILENAME))

    // Function to send SSE data to the client
    const sendSSE = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    console.log('filePath', FILENAME, filePath)
    // Watch the file for changes
    fs.watch(FILENAME, (eventType, filename) => {
        if (eventType === 'change') {
            const data = { message: `File ${filename} changed` };
            sendSSE(data);
        }
    });

    // Clean up SSE connection on client disconnect
    req.on('close', () => {
        console.log('SSE connection closed');
    });
});


// app.get('/data', getHeidelberg);

app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}!`)
})
