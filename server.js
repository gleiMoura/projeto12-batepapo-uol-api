import express from "express";
import { json } from "express";
import cors from "cors";
import chalk from "chalk";
import { MongoClient } from "mongodb";
import dayjs from "dayjs";
import joi from 'joi';

import dotenv from "dotenv";
dotenv.config();

let db;
const mongoClient = new MongoClient(process.env.MONGO_URL);
mongoClient.connect().then(() => {
    db = mongoClient.db(process.env.DATABASE);
    console.log(chalk.green.bold("Mongo is working!"))
})


const app = express();
app.use(json());
app.use(cors());

app.post('/participants', async (req, res) => {
    const nameSchema = joi.object({
        name: joi.string().required()
    });

    const participant = nameSchema.validate(req.body);

    const hour = dayjs().hour();
    const min = dayjs().minute();
    const sec = dayjs().second();

    const { name } = req.body;

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (participant.error) {
            return res.status(422).send("name deve ser strings não vazio!");
        } else {
            const existParticipant = await db.collection("participants").findOne({name: name});
            if (existParticipant) {
                console.log(`User ${name} exist in database`);
                return res.sendStatus(409);
            } else {
                await db.collection("participants").insertOne({ name: req.body.name, lastStatus: Date.now() });

                await db.collection("messages").insertOne({ from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: `${hour}:${min}:${sec}` });

                return res.sendStatus(201);
            }
        }
    } catch {
        res.sendStatus(500);
    }
})

app.get('/participants', async (req, res) => {
    try {
        mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const participants = await db.collection("participants").find().toArray();
        return res.send(participants);
    } catch (error) {
        console.log(error);
    }
})

app.post('/messages', async (req, res) => {
    const hour = dayjs().hour();
    const min = dayjs().minute();
    const sec = dayjs().second();

    const messageSchema = joi.object({
        to: joi.string().required(),

        text: joi.string().required(),

        type: joi.string().required()
    });

    const message = messageSchema.validate(req.body);
    const user = req.headers.user;
    const existParticipant = await db.collection("participants").find({ name: user }).toArray();
    const typeBoolean = (req.body.type === "message" || req.body.type === "private_message")

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        if (message.error || !req.body.to || !req.body.text || (existParticipant.name !== user) || !typeBoolean) {
            return res.sendStatus(422);
        } else {
            await db.collection("messages").insertOne({ from: user, to: req.body.to, text: req.body.text, type: req.body.type, time: `${hour}:${min}:${sec}` });
            return res.sendStatus(201);
        }
    } catch {
        res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    const { limit } = req.query;
    const { user } = req.headers;

    try {
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const existUserTo = await db.collection("messages").findOne({ to: user });
        const existUserFrom = await db.collection("messages").findOne({ from: user });
        if (!existUserFrom && !existUserTo) {
            return res.sendStatus(404);
        }

        const messages = await db.collection("messages").find().toArray();

        const userMessages = messages.filter(element => {
            if (element.from === user ||
                element.type === "status" ||
                element.type === "message" ||
                (element.to === user && element.type === "private-message") ||
                (element.from === user && element.type === "private-message")
            ) {
                return element;
            }
        })

        if (limit < userMessages.length) {
            const allMessages = [];

            for (let i = messages.length - 1; i > messages.length - limit; i--) {
                allMessages.push(messages[i]);
            }
            return res.send(allMessages)
        }

        if (!limit || limit > userMessages.length) {
            return res.send(userMessages)
        }
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }

})

app.post('status', async (req, res) => {
    const { user } = req.headers;

    try {
        mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const existUser = await db.collection("participants").findOne({ name: user });
        if (!existUser) {
            return res.sendStatus(404);
        }

        await db.collection("participants").updateOne(
            { name: user },
            { $set: { lastStatus: Date.now() } }
        );

        res.sendStatus(200);
    } catch (err) {
        res.sendStatus(500);
        console.error(err);
    }
})

setInterval(async () =>{
    const hour = dayjs().hour();
    const min = dayjs().minute();
    const sec = dayjs().second();

    try{
        await mongoClient.connect();
        db = mongoClient.db(process.env.DATABASE);

        const compareStatus = Date.now() - 10000;
        
        const participants = await db.collection("participants").find().toArray();
        participants.forEach(element => {
            if(parseInt(element.status) >= compareStatus){
                db.collection("participants").deleteOne({name: element.name});
                db.collection("messages").insertOne({ from: element.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: `${hour}:${min}:${sec}`})
            }
        });
    }catch (err){
        console.error(err);
    }
}, 15000)

app.listen(process.env.PORT, () => console.log(chalk.green.bold("Server is working in port " + process.env.PORT)));


