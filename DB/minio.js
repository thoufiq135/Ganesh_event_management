const Minio = require("minio");
require("dotenv").config()
const minioClient = new Minio.Client({
    endPoint: "100.126.182.3", 
    port: 9000,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin123",
});
async function connectMinio() {
    try {
        const buckets = await minioClient.listBuckets();
        console.log("🟢connected to minio");
    } catch (err) {
        console.error(err);
    }
}
module.exports = {minioClient,connectMinio};