const express=require("express")
const app=express()
require("dotenv").config()
app.use(express.json())
app.get("/",(req,res)=>{
    res.send(`<h1>server is running on port ${process.env.PORT}</h1>`)
})
app.listen(process.env.PORT,()=>{
    console.log("server started on port = ",process.env.PORT)
})