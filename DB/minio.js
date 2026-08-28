const Minio = require("minio");

const bucketName = "police";

const minioClient = new Minio.Client({
    endPoint: "100.126.182.3",
    port: 9000,
    useSSL: false,
    accessKey: "minioadmin",
    secretKey: "minioadmin123"
});


// ======================================================
// CONNECT MINIO
// ======================================================

const connectMinio = async () => {

    try {

        const exists =
            await minioClient.bucketExists(bucketName);

        if (!exists) {

            await minioClient.makeBucket(bucketName);

            console.log(`MinIO bucket created: ${bucketName}`);

        } else {

            console.log(`MinIO bucket exists: ${bucketName}`);
        }

        return true;

    } catch (error) {

        console.error("MinIO connection error:", error);

        throw error;
    }
};


// ======================================================
// UPLOAD FILE
// ======================================================

const uploadToMinio = async (file, folder) => {

    try {

        if (!file) {
            throw new Error("File is required");
        }

        // Ensure bucket exists
        await connectMinio();


        const extension =
            file.originalname
                .split(".")
                .pop()
                .toLowerCase();


        const fileName =
            `${Date.now()}-${Math.round(
                Math.random() * 1000000
            )}.${extension}`;


        const objectName =
            `${folder}/${fileName}`;


        // 👇 KEEP THE putObject CODE HERE
        // This is where the actual file is uploaded

        await minioClient.putObject(
            bucketName,
            objectName,
            file.buffer,
            file.size,
            {
                "Content-Type":
                    file.mimetype || "application/octet-stream",

                "Content-Disposition":
                    "inline"
            }
        );


        console.log(
            `File uploaded successfully: ${objectName}`
        );


        return objectName;

    } catch (error) {

        console.error(
            "MinIO upload error:",
            error
        );

        throw error;
    }
};


// ======================================================
// GENERATE VIEW URL
// ======================================================

const getMinioUrl = async (objectName) => {

    try {

        if (!objectName) {
            return null;
        }

        const extension =
            objectName
                .split(".")
                .pop()
                .toLowerCase();

        let contentType = "application/octet-stream";

        if (
            extension === "jpg" ||
            extension === "jpeg"
        ) {
            contentType = "image/jpeg";
        } else if (extension === "png") {
            contentType = "image/png";
        } else if (extension === "webp") {
            contentType = "image/webp";
        } else if (extension === "pdf") {
            contentType = "application/pdf";
        }

        return await minioClient.presignedGetObject(
            bucketName,
            objectName,
            60 * 60,
            {
                "response-content-disposition": "inline",
                "response-content-type": contentType
            }
        );

    } catch (error) {

        console.error(
            "MinIO URL generation error:",
            error
        );

        return null;
    }
};


module.exports = {
    minioClient,
    connectMinio,
    uploadToMinio,
    getMinioUrl
};