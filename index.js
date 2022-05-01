import express from "express";
import cors from "cors";
import chalk from "chalk";
import { json } from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();
app.use(json);
app.use(cors);
dotenv.config();


const mongoClient = new MongoClient(process.env.MONGO_URL);
const promise = mongoClient.connect();
let db;
promise.then(() =>{
    db = mongoClient.db("participants");
    console.log(chalk.green.bold("mongodb is working!"))
});
promise.catch((e) => {
    console.log(chalk.red.bold("Mongo is not working", e));
});

app.listen(5000, () => {
    console.log(chalk.green.bold("API is working in port 5000"));
});

app.post('/participants', async (req, res) => {
    const nameSchema = joi.object({
        name: joi.string().required()
    })
    const participant = nameSchema.validate(req.body);

    const hour = dayjs().hour();
    const min = dayjs().minute();
    const sec = dayjs().second();
    try{
        if(participant.error){
            res.status(422).send("name deve ser strings não vazio!");
        }else{
            const existParticipant = await db.collection("participants").find(req.body.name).toArray();
            if(existParticipant.name === req.body.name){
                res.sendStatus(409);
            }else{
                await db.collection("participants").insertOne({name: req.body.name, lastStatus: Date.now()});

                await db.collection("participants").insertOne({from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: `${hour}:${min}:${sec}`});

                res.sendStatus(201);
            }
        }
    }catch{
        res.sendStatus(500);
    }
})

app.get('/participants', async (req, res) => {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
})



