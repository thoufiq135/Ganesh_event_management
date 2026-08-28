const express=require("express")
const multer=require("multer")
const router=express.Router()
const bcrypt=require("bcrypt")
const {minioClient,connectMinio,uploadToMinio}=require("../DB/minio")
const {connectDB,pool}=require("../DB/psql")
const {redis,connectRedis}=require("../DB/redis")
async function CreateSendOTP(email) {
    const otp=Math.floor(100000 + Math.random() * 900000)
    console.log("otp=",otp)
        await redis.set(`otp:${email}`, otp, "EX", 300)
        //   await sendEmail(email, "OTP Verification", `Your OTP is ${otp} expires in 5 minutes`);
          return true
}

// Your existing functions/middleware

// const { sendEmail } = require("../utils/sendEmail");
// const redis = require("../DB/redis");

// --------------------------------------------------
// Multer configuration
// --------------------------------------------------

const upload = multer({
    storage: multer.memoryStorage()
});

// --------------------------------------------------
// Create Employee / User
// --------------------------------------------------
router.post( "/createEmployee",upload.fields([
        { name: "aadhaar", maxCount: 1 },
        { name: "profile_pic", maxCount: 1 },
        { name: "voter_id", maxCount: 1 },
        { name: "driving_license", maxCount: 1 }
    ]),async (req, res) => {

        // --------------------------------------------------
        // 1. Get body fields
        // --------------------------------------------------

        const {
            fullname,
            gender,
            date_of_birth,
            email,
            phonenumber,
            address,
            password
        } = req.body;

        // --------------------------------------------------
        // 2. Get uploaded files
        // --------------------------------------------------

        const aadhaarFile =
            req.files?.aadhaar?.[0];

        const profilePicFile =
            req.files?.profile_pic?.[0];

        const voterIdFile =
            req.files?.voter_id?.[0];

        const drivingLicenseFile =
            req.files?.driving_license?.[0];

        // --------------------------------------------------
        // 3. Validate required fields
        // --------------------------------------------------

        if (
            !fullname ||
            !email ||
            !phonenumber ||
            !address ||
            !date_of_birth ||
            !gender ||
            !password
        ) {
            return res.status(400).json({
                message:
                    "fullname, gender, date_of_birth, email, phonenumber, address and password are required"
            });
        }

        // --------------------------------------------------
        // 4. Validate documents
        // --------------------------------------------------

        if (
            !aadhaarFile ||
            !profilePicFile ||
            !voterIdFile ||
            !drivingLicenseFile
        ) {
            return res.status(400).json({
                message:
                    "Aadhaar, profile picture, Voter ID and Driving Licence are required"
            });
        }

        const client = await pool.connect();

        try {

            await client.query("BEGIN");

            const cleanEmail =
                email.trim().toLowerCase();

            const cleanPhone =
                phonenumber.trim();

            // --------------------------------------------------
            // 5. Check existing email
            // --------------------------------------------------

            const existingEmail =
                await client.query(
                    `
                    SELECT id
                    FROM employees
                    WHERE LOWER(email) = $1
                    LIMIT 1
                    `,
                    [cleanEmail]
                );

            if (
                existingEmail.rows.length > 0
            ) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message:
                        "User with this email already exists"
                });
            }

            // --------------------------------------------------
            // 6. Check existing phone number
            // --------------------------------------------------

            const existingPhone =
                await client.query(
                    `
                    SELECT id
                    FROM employees
                    WHERE phonenumber = $1
                    LIMIT 1
                    `,
                    [cleanPhone]
                );

            if (
                existingPhone.rows.length > 0
            ) {
                await client.query("ROLLBACK");

                return res.status(400).json({
                    message:
                        "User with this phone number already exists"
                });
            }

            // --------------------------------------------------
            // 7. Hash password
            // --------------------------------------------------

            const encryptedPassword =
                await bcrypt.hash(password, 10);

            // --------------------------------------------------
            // 8. Ensure MinIO connection
            // --------------------------------------------------

            await connectMinio();

            // --------------------------------------------------
            // 9. Upload Aadhaar
            // --------------------------------------------------

            const aadhaarImagePath =
                await uploadToMinio(
                    aadhaarFile,
                    "employees/aadhaar"
                );

            // --------------------------------------------------
            // 10. Upload profile picture
            // --------------------------------------------------

            const profilePicPath =
                await uploadToMinio(
                    profilePicFile,
                    "employees/profile-pictures"
                );

            // --------------------------------------------------
            // 11. Upload Voter ID
            // --------------------------------------------------

            const voterIdImagePath =
                await uploadToMinio(
                    voterIdFile,
                    "employees/voter-id"
                );

            // --------------------------------------------------
            // 12. Upload Driving Licence
            // --------------------------------------------------

            const drivingLicenseImagePath =
                await uploadToMinio(
                    drivingLicenseFile,
                    "employees/driving-license"
                );

            // --------------------------------------------------
            // 13. Create employee/user
            // --------------------------------------------------

            const employeeResult =
                await client.query(
                    `
                    INSERT INTO employees (
                        fullname,
                        gender,
                        date_of_birth,
                        email,
                        phonenumber,
                        address,
                        password_hash,

                        profile_pic_path,
                        aadhaar_image_path,
                        voter_id_image_path,
                        driving_license_image_path,

                        status,
                        profile_completed,
                        profile_verified,

                        created_at,
                        updated_at
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7,
                        $8, $9, $10, $11,
                        TRUE, TRUE, FALSE,
                        NOW(), NOW()
                    )
                    RETURNING
                        id,
                        fullname,
                        gender,
                        date_of_birth,
                        email,
                        phonenumber,
                        address,
                        profile_pic_path,
                        profile_completed,
                        profile_verified,
                        status,
                        created_at
                    `,
                    [
                        fullname.trim(),
                        gender.trim(),
                        date_of_birth,
                        cleanEmail,
                        cleanPhone,
                        address.trim(),
                        encryptedPassword,

                        profilePicPath,
                        aadhaarImagePath,
                        voterIdImagePath,
                        drivingLicenseImagePath
                    ]
                );

            const employee =
                employeeResult.rows[0];

            // --------------------------------------------------
            // 14. Commit transaction
            // --------------------------------------------------

            await client.query("COMMIT");

            // --------------------------------------------------
            // 15. Send OTP
            // --------------------------------------------------

            const mailSend =
                await CreateSendOTP(
                    employee.email
                );

            if (!mailSend) {

                console.error(
                    `Employee created but OTP email failed: ${employee.email}`
                );

                return res.status(201).json({
                    message:
                        "Account created successfully, but OTP could not be sent.",

                    data: {
                        employee_id:
                            employee.id,

                        fullname:
                            employee.fullname,

                        email:
                            employee.email,

                        profile_completed:
                            employee.profile_completed,

                        profile_verified:
                            employee.profile_verified
                    }
                });
            }

            // --------------------------------------------------
            // 16. Success response
            // --------------------------------------------------

            return res.status(201).json({

                message:
                    "Account created successfully. OTP sent to email.",

                data: {

                    employee_id:
                        employee.id,

                    fullname:
                        employee.fullname,

                    gender:
                        employee.gender,

                    date_of_birth:
                        employee.date_of_birth,

                    email:
                        employee.email,

                    phonenumber:
                        employee.phonenumber,

                    address:
                        employee.address,

                    profile_completed:
                        employee.profile_completed,

                    profile_verified:
                        employee.profile_verified,

                    status:
                        employee.status,

                    created_at:
                        employee.created_at
                }
            });

        } catch (error) {

            // --------------------------------------------------
            // Rollback transaction
            // --------------------------------------------------

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Rollback error:",
                    rollbackError
                );
            }

            // --------------------------------------------------
            // PostgreSQL unique violation
            // --------------------------------------------------

            if (error.code === "23505") {

                return res.status(400).json({
                    message:
                        "Email or phone number already exists"
                });
            }

            console.error(
                "Create employee error:",
                error
            );

            return res.status(500).json({
                message:
                    "Internal server error"
            });

        } finally {

            client.release();
        }
    }
);


router.post("/createPolicestation",  async (req, res) => {
    const {
        name,
        email,
        phonenumber,
        address,
        password
    } = req.body;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (
        !name ||
        !email ||
        !phonenumber ||
        !address ||
        !password
    ) {
        return res.status(400).json({
            message:
                "name, email, phonenumber, address and password are required"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // --------------------------------------------------
        // 2. Check email
        // --------------------------------------------------

        const existingEmail = await client.query(
            `
            SELECT id
            FROM police_stations
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email.trim()]
        );

        if (existingEmail.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    "Police station with this email already exists"
            });
        }

        // --------------------------------------------------
        // 3. Check phone number
        // --------------------------------------------------

        const existingPhone = await client.query(
            `
            SELECT id
            FROM police_stations
            WHERE phonenumber = $1
            LIMIT 1
            `,
            [phonenumber.trim()]
        );

        if (existingPhone.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    "Police station with this phone number already exists"
            });
        }

        // --------------------------------------------------
        // 4. Hash password
        // --------------------------------------------------

        const encryptedPassword =
            await bcrypt.hash(password, 10);

        // --------------------------------------------------
        // 5. Create police station account
        // --------------------------------------------------

        const policeStationResult = await client.query(
            `
            INSERT INTO police_stations (
                name,
                email,
                phonenumber,
                address,
                password_hash,
                status,
                profile_verified
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                TRUE,
                FALSE
            )
            RETURNING
                id,
                name,
                email,
                phonenumber,
                address,
                status,
                profile_verified,
                created_at
            `,
            [
                name.trim(),
                email.trim().toLowerCase(),
                phonenumber.trim(),
                address.trim(),
                encryptedPassword
            ]
        );

        const policeStation =
            policeStationResult.rows[0];

        // --------------------------------------------------
        // 6. Commit database transaction
        // --------------------------------------------------

        await client.query("COMMIT");

        // --------------------------------------------------
        // 7. Send OTP
        // --------------------------------------------------

        const mailSend =
            await CreateSendOTP(policeStation.email);

        if (!mailSend) {

            console.error(
                `Police station created but OTP email failed: ${policeStation.email}`
            );

            return res.status(201).json({
                message:
                    "Police station created successfully, but OTP could not be sent.",

                data: {
                    police_station_id:
                        policeStation.id,

                    name:
                        policeStation.name,

                    email:
                        policeStation.email,

                    profile_verified:
                        policeStation.profile_verified
                }
            });
        }

        // --------------------------------------------------
        // 8. Success response
        // --------------------------------------------------

        return res.status(201).json({
            message:
                "Police station account created successfully. OTP sent to email.",

            data: {
                police_station_id:
                    policeStation.id,

                name:
                    policeStation.name,

                email:
                    policeStation.email,

                phonenumber:
                    policeStation.phonenumber,

                profile_verified:
                    policeStation.profile_verified
            }
        });

    } catch (error) {

        // --------------------------------------------------
        // Rollback
        // --------------------------------------------------

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Rollback error:",
                rollbackError
            );
        }

        // --------------------------------------------------
        // PostgreSQL unique violation
        // --------------------------------------------------

        if (error.code === "23505") {

            return res.status(400).json({
                message:
                    "Email or phone number already exists"
            });
        }

        console.error(
            "Create police station error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });

    } finally {

        client.release();
    }
});
router.post("/createAdmin",  async (req, res) => {
    const {
        name,
        email,
        phonenumber,
        address,
        role,
        password
    } = req.body;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (
        !name ||
        !email ||
        !phonenumber ||
        !role ||
        !password
    ) {
        return res.status(400).json({
            message:
                "name, email, phonenumber, role and password are required"
        });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // --------------------------------------------------
        // 2. Check email
        // --------------------------------------------------

        const existingEmail = await client.query(
            `
            SELECT id
            FROM admins
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email.trim()]
        );

        if (existingEmail.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    "Admin with this email already exists"
            });
        }

        // --------------------------------------------------
        // 3. Check phone number
        // --------------------------------------------------

        const existingPhone = await client.query(
            `
            SELECT id
            FROM admins
            WHERE phonenumber = $1
            LIMIT 1
            `,
            [phonenumber.trim()]
        );

        if (existingPhone.rows.length > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    "Admin with this phone number already exists"
            });
        }

        // --------------------------------------------------
        // 4. Hash password
        // --------------------------------------------------

        const encryptedPassword =
            await bcrypt.hash(password, 10);

        // --------------------------------------------------
        // 5. Create admin account
        // --------------------------------------------------

        const adminResult = await client.query(
            `
            INSERT INTO admins (
                name,
                email,
                phonenumber,
                address,
                role,
                password_hash,
                status,
                profile_verified
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                TRUE,
                FALSE
            )
            RETURNING
                id,
                name,
                email,
                phonenumber,
                address,
                role,
                status,
                profile_verified,
                created_at
            `,
            [
                name.trim(),
                email.trim().toLowerCase(),
                phonenumber.trim(),
                address?.trim() || null,
                role.trim(),
                encryptedPassword
            ]
        );

        const admin = adminResult.rows[0];

        // --------------------------------------------------
        // 6. Commit database transaction
        // --------------------------------------------------

        await client.query("COMMIT");

        // --------------------------------------------------
        // 7. Send OTP
        // --------------------------------------------------

        const mailSend =
            await CreateSendOTP(admin.email);

        if (!mailSend) {

            console.error(
                `Admin created but OTP email failed: ${admin.email}`
            );

            return res.status(201).json({
                message:
                    "Admin created successfully, but OTP could not be sent.",

                data: {
                    admin_id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    profile_verified:
                        admin.profile_verified
                }
            });
        }

        // --------------------------------------------------
        // 8. Success response
        // --------------------------------------------------

        return res.status(201).json({
            message:
                "Admin account created successfully. OTP sent to email.",

            data: {
                admin_id: admin.id,
                name: admin.name,
                email: admin.email,
                phonenumber: admin.phonenumber,
                role: admin.role,
                profile_verified:
                    admin.profile_verified
            }
        });

    } catch (error) {

        // --------------------------------------------------
        // Rollback
        // --------------------------------------------------

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Rollback error:",
                rollbackError
            );
        }

        // --------------------------------------------------
        // PostgreSQL unique violation
        // --------------------------------------------------

        if (error.code === "23505") {

            return res.status(400).json({
                message:
                    "Email or phone number already exists"
            });
        }

        console.error(
            "Create admin error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });

    } finally {

        client.release();
    }
});
router.put("/verifyuserRegister",  async (req, res) => {
    const {
        otp,
        email,
        table
    } = req.body;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (!otp || !email || !table) {
        return res.status(400).json({
            message: "OTP, email and table are required"
        });
    }

    // --------------------------------------------------
    // 2. Allowed tables
    // --------------------------------------------------
console.log(table)
    const allowedTables = {
        employee: "employees",
        employees: "employees",

        policestation: "police_stations",
        police_station: "police_stations",

        admin: "admins",
        admins: "admins"
    };

    const selectedTable =
        allowedTables[table.trim().toLowerCase()];

    if (!selectedTable) {
        return res.status(400).json({
            message:
                "Invalid table. Use employee, police_station or admin"
        });
    }

    try {
        const cleanEmail =
            email.trim().toLowerCase();

        const cleanOtp =
            otp.trim();

        // --------------------------------------------------
        // 3. Get OTP from Redis
        // --------------------------------------------------

        const storedOtp =
            await redis.get(`otp:${cleanEmail}`);

        if (!storedOtp) {
            return res.status(400).json({
                message: "OTP expired"
            });
        }

        // --------------------------------------------------
        // 4. Compare OTP
        // --------------------------------------------------

        if (storedOtp !== cleanOtp) {
            return res.status(400).json({
                message: "OTP invalid"
            });
        }

        // --------------------------------------------------
        // 5. Find account
        // --------------------------------------------------

        const accountResult = await pool.query(
            `
            SELECT
                id,
                email,
                profile_verified,
                status
            FROM ${selectedTable}
            WHERE LOWER(email) = $1
            LIMIT 1
            `,
            [cleanEmail]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account =
            accountResult.rows[0];

        // --------------------------------------------------
        // 6. Check account status
        // --------------------------------------------------

        if (!account.status) {
            return res.status(403).json({
                message: "Account is inactive"
            });
        }

        // --------------------------------------------------
        // 7. Already verified
        // --------------------------------------------------

        if (account.profile_verified) {

            await redis.del(
                `otp:${cleanEmail}`
            );

            return res.status(400).json({
                message:
                    "Account is already verified"
            });
        }

        // --------------------------------------------------
        // 8. Verify account
        // --------------------------------------------------

        const result = await pool.query(
            `
            UPDATE ${selectedTable}
            SET
                profile_verified = TRUE,
                updated_at = NOW()
            WHERE id = $1
            RETURNING
                id,
                email,
                profile_verified
            `,
            [account.id]
        );

        if (result.rows.length === 0) {
            return res.status(500).json({
                message:
                    "Account verification failed"
            });
        }

        // --------------------------------------------------
        // 9. Delete OTP
        // --------------------------------------------------

        await redis.del(
            `otp:${cleanEmail}`
        );

        // --------------------------------------------------
        // 10. Success
        // --------------------------------------------------

        return res.status(200).json({
            message:
                "Account verified successfully",

            data: {
                id: result.rows[0].id,
                email: result.rows[0].email,
                profile_verified:
                    result.rows[0].profile_verified,
                account_type: selectedTable
            }
        });

    } catch (error) {

        console.error(
            "Verify account error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });
    }
});
router.put("/applyforgotpassword", async (req, res) => {
    const {
        email,
        table
    } = req.body;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (!email || !table) {
        return res.status(400).json({
            message: "Email and table are required"
        });
    }

    // --------------------------------------------------
    // 2. Allowed account types
    // --------------------------------------------------

    const allowedTables = {
        employee: "employees",
        employees: "employees",

        policestation: "police_stations",
        police_station: "police_stations",

        admin: "admins",
        admins: "admins"
    };

    const selectedTable =
        allowedTables[table.trim().toLowerCase()];

    if (!selectedTable) {
        return res.status(400).json({
            message:
                "Invalid table. Use employee, police_station or admin"
        });
    }

    try {

        const cleanEmail =
            email.trim().toLowerCase();

        // --------------------------------------------------
        // 3. Find account
        // --------------------------------------------------

        const accountResult = await pool.query(
            `
            SELECT
                id,
                email,
                status,
                profile_verified
            FROM ${selectedTable}
            WHERE LOWER(email) = $1
            LIMIT 1
            `,
            [cleanEmail]
        );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account =
            accountResult.rows[0];

        // --------------------------------------------------
        // 4. Check account status
        // --------------------------------------------------

        if (!account.status) {
            return res.status(403).json({
                message: "Account is inactive"
            });
        }

        // --------------------------------------------------
        // 5. Generate OTP
        // --------------------------------------------------

        const otp =
            Math.floor(
                100000 + Math.random() * 900000
            ).toString();

        // --------------------------------------------------
        // 6. Store OTP in Redis
        // --------------------------------------------------

        await redis.set(
            `forgot-password-otp:${cleanEmail}`,
            otp,
            {
                EX: 300
            }
        );

        // --------------------------------------------------
        // 7. Send OTP to email
        // --------------------------------------------------

        const mailSend =
            await SendForgotPasswordOTP(
                cleanEmail,
                otp
            );

        if (!mailSend) {

            await redis.del(
                `forgot-password-otp:${cleanEmail}`
            );

            console.error(
                `Forgot password OTP email failed: ${cleanEmail}`
            );

            return res.status(500).json({
                message:
                    "Unable to send OTP. Please try again later."
            });
        }

        // --------------------------------------------------
        // 8. Success response
        // --------------------------------------------------

        return res.status(200).json({
            message:
                "Forgot password OTP sent successfully",
            data: {
                email: cleanEmail,
                account_type: selectedTable,
                expires_in: 300
            }
        });

    } catch (error) {

        console.error(
            "Forgot password OTP error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });
    }
});
router.put("/verifyforgotpassword",  async (req, res) => {
    const {
        otp,
        email,
        table,
        new_password
    } = req.body;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (
        !otp ||
        !email ||
        !table ||
        !new_password
    ) {
        return res.status(400).json({
            message:
                "OTP, email, table and new password are required"
        });
    }

    // --------------------------------------------------
    // 2. Validate password
    // --------------------------------------------------

    if (new_password.length < 8) {
        return res.status(400).json({
            message:
                "Password must be at least 8 characters long"
        });
    }

    // --------------------------------------------------
    // 3. Allowed account types
    // --------------------------------------------------

    const allowedTables = {
        employee: "employees",
        employees: "employees",

        policestation: "police_stations",
        police_station: "police_stations",

        admin: "admins",
        admins: "admins"
    };

    const selectedTable =
        allowedTables[
            table.trim().toLowerCase()
        ];

    if (!selectedTable) {
        return res.status(400).json({
            message:
                "Invalid table. Use employee, police_station or admin"
        });
    }

    try {

        const cleanEmail =
            email.trim().toLowerCase();

        const cleanOtp =
            otp.trim();

        // --------------------------------------------------
        // 4. Get OTP from Redis
        // --------------------------------------------------

        const storedOtp =
            await redis.get(
                `forgot-password-otp:${cleanEmail}`
            );

        if (!storedOtp) {
            return res.status(400).json({
                message:
                    "OTP expired. Please request a new OTP."
            });
        }

        // --------------------------------------------------
        // 5. Compare OTP
        // --------------------------------------------------

        if (storedOtp !== cleanOtp) {
            return res.status(400).json({
                message: "Invalid OTP"
            });
        }

        // --------------------------------------------------
        // 6. Find account
        // --------------------------------------------------

        const accountResult =
            await pool.query(
                `
                SELECT
                    id,
                    email,
                    status
                FROM ${selectedTable}
                WHERE LOWER(email) = $1
                LIMIT 1
                `,
                [cleanEmail]
            );

        if (accountResult.rows.length === 0) {
            return res.status(404).json({
                message: "Account not found"
            });
        }

        const account =
            accountResult.rows[0];

        // --------------------------------------------------
        // 7. Check account status
        // --------------------------------------------------

        if (!account.status) {
            return res.status(403).json({
                message:
                    "Account is inactive"
            });
        }

        // --------------------------------------------------
        // 8. Hash new password
        // --------------------------------------------------

        const encryptedPassword =
            await bcrypt.hash(
                new_password,
                10
            );

        // --------------------------------------------------
        // 9. Update password
        // --------------------------------------------------

        const result =
            await pool.query(
                `
                UPDATE ${selectedTable}
                SET
                    password_hash = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING
                    id,
                    email
                `,
                [
                    encryptedPassword,
                    account.id
                ]
            );

        if (result.rows.length === 0) {
            return res.status(500).json({
                message:
                    "Password update failed"
            });
        }

        // --------------------------------------------------
        // 10. Delete OTP
        // --------------------------------------------------

        await redis.del(
            `forgot-password-otp:${cleanEmail}`
        );

        // --------------------------------------------------
        // 11. Success
        // --------------------------------------------------

        return res.status(200).json({
            message:
                "Password updated successfully",

            data: {
                id: result.rows[0].id,
                email: result.rows[0].email,
                account_type: selectedTable
            }
        });

    } catch (error) {

        console.error(
            "Verify forgot password error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });
    }
});
router.post("/userLogin", async (req, res) => {

    const {
        email,
        password,
        table
    } = req.body;

    // --------------------------------------------------
    // 1. Validate required fields
    // --------------------------------------------------

    if (!email || !password || !table) {
        return res.status(400).json({
            message:
                "Email, password and table are required"
        });
    }

    // --------------------------------------------------
    // 2. Allowed account types
    // --------------------------------------------------

    const allowedTables = {
        employee: "employees",
        employees: "employees",

        policestation: "police_stations",
        police_station: "police_stations",

        admin: "admins",
        admins: "admins"
    };

    const selectedTable =
        allowedTables[
            table.trim().toLowerCase()
        ];

    if (!selectedTable) {
        return res.status(400).json({
            message:
                "Invalid account type. Use employee, police_station or admin"
        });
    }

    try {

        const cleanEmail =
            email.trim().toLowerCase();

        // --------------------------------------------------
        // 3. Find account
        // --------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                fullname,
                email,
                phonenumber,
                address,
                role,
                password_hash,
                status,
                profile_verified,
                profile_completed,

                profile_pic_path

            FROM ${selectedTable}

            WHERE LOWER(email) = $1

            LIMIT 1
            `,
            [cleanEmail]
        );

        const user =
            result.rows[0];

        // --------------------------------------------------
        // 4. Account not found
        // --------------------------------------------------

        if (!user) {
            return res.status(400).json({
                message:
                    "User not registered"
            });
        }

        // --------------------------------------------------
        // 5. Check account status
        // --------------------------------------------------

        if (!user.status) {
            return res.status(403).json({
                message:
                    "Your account is deactivated."
            });
        }

        // --------------------------------------------------
        // 6. Check password
        // --------------------------------------------------

        const correctPassword =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (!correctPassword) {
            return res.status(401).json({
                message:
                    "Invalid email or password"
            });
        }

        // --------------------------------------------------
        // 7. Check email verification
        // --------------------------------------------------

        if (!user.profile_verified) {
            return res.status(401).json({
                message:
                    "Email verification required"
            });
        }

        // --------------------------------------------------
        // 8. Generate profile picture URL
        // --------------------------------------------------

        let profilePicUrl = null;

        if (
            selectedTable === "employees" &&
            user.profile_pic_path
        ) {

            try {

                /*
                 * IMPORTANT:
                 *
                 * Change this bucket name to your
                 * actual MinIO bucket name.
                 */

                const bucketName =
                    process.env.MINIO_BUCKET || "events";

                profilePicUrl =
                    await minioClient.presignedGetObject(
                        bucketName,
                        user.profile_pic_path,
                        60 * 60
                    );

            } catch (minioError) {

                console.error(
                    "Profile picture URL generation error:",
                    minioError
                );

                profilePicUrl = null;
            }
        }

        // --------------------------------------------------
        // 9. Create JWT
        // --------------------------------------------------

        const token =
            await createJwt({

                id:
                    user.id,

                email:
                    user.email,

                account_type:
                    selectedTable,

                role:
                    user.role || null,

                name:
                    user.name ||
                    user.fullname,

                phonenumber:
                    user.phonenumber,

                profile_pic:
                    profilePicUrl,

                profile_verified:
                    user.profile_verified,

                profile_completed:
                    user.profile_completed ?? null
            });

        if (!token) {
            return res.status(500).json({
                message:
                    "JWT creation error"
            });
        }

        // --------------------------------------------------
        // 10. Login successful
        // --------------------------------------------------

        return res.status(200).json({

            message:
                "Login successful",

            Logintoken:
                token,

            data: {

                id:
                    user.id,

                name:
                    user.name ||
                    user.fullname,

                fullname:
                    user.fullname ||
                    null,

                email:
                    user.email,

                phonenumber:
                    user.phonenumber,

                address:
                    user.address,

                role:
                    user.role ||
                    null,

                account_type:
                    selectedTable,

                profile_pic:
                    profilePicUrl,

                profile_verified:
                    user.profile_verified,

                profile_completed:
                    user.profile_completed ??
                    null
            }
        });

    } catch (error) {

        console.error(
            "Error at /userLogin:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });
    }
});

module.exports=router
