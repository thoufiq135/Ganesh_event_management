const express=require("express")
const app=express()
const cors=require("cors")
const {minioClient,connectMinio,uploadToMinio}=require("./DB/minio")
const {connectDB,pool}=require("./DB/psql")
const {redis,connectRedis}=require("./DB/redis")
const auth=require("./api/authenticate")
const requests=require("./api/requests")
require("dotenv").config()
app.use(cors({
    origin:"*"
}))
app.use(express.json())
connectDB()
connectMinio()
connectRedis()
app.use("/api/auth",auth)
app.use("/api/request",requests)
app.get("/",(req,res)=>{
    res.send(`<h1>server is running on port ${process.env.PORT}</h1>`)
})
app.listen("3000",()=>{
    console.log("server started on port = 3000")
})