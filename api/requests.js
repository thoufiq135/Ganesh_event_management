const express=require("express")
const router=express.Router()
const {minioClient,connectMinio}=require("../DB/minio")
const {connectDB,pool}=require("../DB/psql")
const multer=require("multer")
const upload = multer({
    storage: multer.memoryStorage()
});
router.post(
    "/addEvent",
 

    upload.fields([
        {
            name: "location_photo",
            maxCount: 1
        }
    ]),

    async (req, res) => {

        // --------------------------------------------------
        // 1. Get logged-in employee from JWT
        // --------------------------------------------------

        const empid = req.user?.id;

        if (!empid) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // --------------------------------------------------
        // 2. Get request body
        // --------------------------------------------------

        const {
            committee_name,
            committee_registration_number,
            committee_address,
            committee_village_town,
            committee_mandal,

            id_proof_type,
            id_proof_number,

            mandapam_name,
            landmark,
            mandapam_address,
            mandapam_village_town,
            mandapam_mandal,
            district,

            installation_date,
            festival_start_date,
            festival_end_date,

            daily_start_time,
            daily_end_time,

            expected_visitors,
            idol_height_ft,

            sound_system_required,
            electrical_connection_required,
            generator_required,
            procession_required,

            place_of_mandapam,
            special_event_details,

            nimarjanam_date,
            nimarjanam_location,

            shobha_yatra_start_time,
            shobha_yatra_end_time,

            cultural_events_with_yatra,
            specify_other_cultural_event,
            additional_nimarjanam_details,

            latitude,
            longitude
        } = req.body;

        // --------------------------------------------------
        // 3. Get location photo
        // --------------------------------------------------

        const locationPhoto =
            req.files?.location_photo?.[0];

        // --------------------------------------------------
        // 4. Validate required text fields
        // --------------------------------------------------

        const requiredFields = {
            committee_name,
            committee_registration_number,
            committee_address,
            committee_village_town,
            committee_mandal,

            id_proof_type,
            id_proof_number,

            mandapam_name,
            landmark,
            mandapam_address,
            mandapam_village_town,
            mandapam_mandal,
            district,

            installation_date,
            festival_start_date,
            festival_end_date,

            daily_start_time,
            daily_end_time,

            expected_visitors,
            idol_height_ft,

            place_of_mandapam,
            special_event_details,

            nimarjanam_date,
            nimarjanam_location,

            shobha_yatra_start_time,
            shobha_yatra_end_time,

            cultural_events_with_yatra,
            specify_other_cultural_event,
            additional_nimarjanam_details,

            latitude,
            longitude
        };

        for (
            const [field, value]
            of Object.entries(requiredFields)
        ) {

            if (
                value === undefined ||
                value === null ||
                String(value).trim() === ""
            ) {
                return res.status(400).json({
                    message:
                        `${field} is required`
                });
            }
        }

        // --------------------------------------------------
        // 5. Validate boolean fields
        // --------------------------------------------------

        const booleanFields = {
            sound_system_required,
            electrical_connection_required,
            generator_required,
            procession_required
        };

        for (
            const [field, value]
            of Object.entries(booleanFields)
        ) {

            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                return res.status(400).json({
                    message:
                        `${field} is required`
                });
            }

            // Multipart form-data sends values as strings
            if (
                value !== true &&
                value !== false &&
                value !== "true" &&
                value !== "false"
            ) {
                return res.status(400).json({
                    message:
                        `${field} must be true or false`
                });
            }
        }

        // --------------------------------------------------
        // 6. Validate location photo
        // --------------------------------------------------

        if (!locationPhoto) {
            return res.status(400).json({
                message:
                    "Location photo is required"
            });
        }

        // --------------------------------------------------
        // 7. Convert boolean values
        // --------------------------------------------------

        const soundSystemRequired =
            sound_system_required === true ||
            sound_system_required === "true";

        const electricalConnectionRequired =
            electrical_connection_required === true ||
            electrical_connection_required === "true";

        const generatorRequired =
            generator_required === true ||
            generator_required === "true";

        const processionRequired =
            procession_required === true ||
            procession_required === "true";

        // --------------------------------------------------
        // 8. Validate GPS
        // --------------------------------------------------

        const latitudeValue =
            Number(latitude);

        const longitudeValue =
            Number(longitude);

        if (
            !Number.isFinite(latitudeValue) ||
            latitudeValue < -90 ||
            latitudeValue > 90
        ) {
            return res.status(400).json({
                message:
                    "Invalid latitude"
            });
        }

        if (
            !Number.isFinite(longitudeValue) ||
            longitudeValue < -180 ||
            longitudeValue > 180
        ) {
            return res.status(400).json({
                message:
                    "Invalid longitude"
            });
        }

        // --------------------------------------------------
        // 9. Validate numeric fields
        // --------------------------------------------------

        const expectedVisitorsValue =
            Number(expected_visitors);

        const idolHeightValue =
            Number(idol_height_ft);

        if (
            !Number.isInteger(
                expectedVisitorsValue
            ) ||
            expectedVisitorsValue <= 0
        ) {
            return res.status(400).json({
                message:
                    "expected_visitors must be a positive integer"
            });
        }

        if (
            !Number.isFinite(
                idolHeightValue
            ) ||
            idolHeightValue <= 0
        ) {
            return res.status(400).json({
                message:
                    "idol_height_ft must be a positive number"
            });
        }

        // --------------------------------------------------
        // 10. Parse cultural events JSON
        // --------------------------------------------------

        let culturalEvents;

        try {

            culturalEvents =
                typeof cultural_events_with_yatra === "string"
                    ? JSON.parse(
                        cultural_events_with_yatra
                    )
                    : cultural_events_with_yatra;

        } catch (error) {

            return res.status(400).json({
                message:
                    "cultural_events_with_yatra must be valid JSON"
            });
        }

        // --------------------------------------------------
        // 11. Validate cultural events
        // --------------------------------------------------

        if (
            !culturalEvents ||
            typeof culturalEvents !== "object"
        ) {
            return res.status(400).json({
                message:
                    "Invalid cultural_events_with_yatra"
            });
        }

        const culturalEventNames = [
            "dj",
            "band",
            "drums",
            "cultural_dance",
            "bhajans",
            "other"
        ];

        for (
            const eventName
            of culturalEventNames
        ) {

            if (
                typeof culturalEvents[eventName]
                    !== "boolean"
            ) {
                return res.status(400).json({
                    message:
                        `cultural_events_with_yatra.${eventName} must be true or false`
                });
            }
        }

        // --------------------------------------------------
        // 12. Validate place of mandapam
        // --------------------------------------------------

        const allowedPlaces = [
            "On Road",
            "Beside Road",
            "Private Place",
            "Govt. Place",
            "Temple Place",
            "Other"
        ];

        if (
            !allowedPlaces.includes(
                place_of_mandapam.trim()
            )
        ) {
            return res.status(400).json({
                message:
                    "Invalid place_of_mandapam"
            });
        }

        // --------------------------------------------------
        // 13. Database connection
        // --------------------------------------------------

        const client =
            await pool.connect();

        try {

            await client.query("BEGIN");

            // --------------------------------------------------
            // 14. Get employee information
            // --------------------------------------------------

            const employeeResult =
                await client.query(
                    `
                    SELECT
                        id,
                        fullname,
                        email,
                        phonenumber,
                        address,
                        status,
                        profile_verified,
                        profile_completed
                    FROM employees
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [empid]
                );

            if (
                employeeResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({
                    message:
                        "Employee account not found"
                });
            }

            const employee =
                employeeResult.rows[0];

            // --------------------------------------------------
            // 15. Check employee status
            // --------------------------------------------------

            if (!employee.status) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(403).json({
                    message:
                        "Employee account is inactive"
                });
            }

            // --------------------------------------------------
            // 16. Check profile verification
            // --------------------------------------------------

            if (!employee.profile_verified) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(403).json({
                    message:
                        "Please verify your email before creating an event"
                });
            }

            // --------------------------------------------------
            // 17. Check profile completion
            // --------------------------------------------------

            if (!employee.profile_completed) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(403).json({
                    message:
                        "Please complete your profile before creating an event"
                });
            }

            // --------------------------------------------------
            // 18. Upload location photo to MinIO
            // --------------------------------------------------

            const locationPhotoPath =
                await minioClient(
                    locationPhoto,
                    "events/location-photos"
                );

            if (!locationPhotoPath) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(500).json({
                    message:
                        "Failed to upload location photo"
                });
            }

            // --------------------------------------------------
            // 19. Create event
            // --------------------------------------------------

            const eventResult =
                await client.query(
                    `
                    INSERT INTO events (

                        empid,

                        committee_name,
                        committee_registration_number,
                        committee_address,
                        committee_village_town,
                        committee_mandal,

                        leader_name,
                        mobile_number,
                        email,

                        id_proof_type,
                        id_proof_number,
                        residential_address,

                        mandapam_name,
                        landmark,
                        mandapam_address,
                        mandapam_village_town,
                        mandapam_mandal,
                        district,

                        installation_date,
                        festival_start_date,
                        festival_end_date,

                        daily_start_time,
                        daily_end_time,

                        expected_visitors,
                        idol_height_ft,

                        sound_system_required,
                        electrical_connection_required,
                        generator_required,
                        procession_required,

                        place_of_mandapam,
                        special_event_details,

                        nimarjanam_date,
                        nimarjanam_location,

                        shobha_yatra_start_time,
                        shobha_yatra_end_time,

                        cultural_events_with_yatra,
                        specify_other_cultural_event,
                        additional_nimarjanam_details,

                        latitude,
                        longitude,
                        location_photo_path,

                        status

                    )
                    VALUES (

                        $1,

                        $2,
                        $3,
                        $4,
                        $5,
                        $6,

                        $7,
                        $8,
                        $9,

                        $10,
                        $11,
                        $12,

                        $13,
                        $14,
                        $15,
                        $16,
                        $17,
                        $18,

                        $19,
                        $20,
                        $21,

                        $22,
                        $23,

                        $24,
                        $25,

                        $26,
                        $27,
                        $28,
                        $29,

                        $30,
                        $31,

                        $32,
                        $33,

                        $34,
                        $35,

                        $36,
                        $37,
                        $38,

                        $39,
                        $40,
                        $41,

                        $42

                    )

                    RETURNING
                        id,
                        empid,
                        committee_name,
                        leader_name,
                        email,
                        mandapam_name,
                        district,
                        latitude,
                        longitude,
                        location_photo_path,
                        status,
                        created_at
                    `,
                    [

                        // $1
                        employee.id,

                        // Committee
                        // $2 - $6
                        committee_name.trim(),
                        committee_registration_number.trim(),
                        committee_address.trim(),
                        committee_village_town.trim(),
                        committee_mandal.trim(),

                        // Employee-derived
                        // $7 - $9
                        employee.fullname,
                        employee.phonenumber,
                        employee.email,

                        // ID proof
                        // $10 - $12
                        id_proof_type.trim(),
                        id_proof_number.trim(),
                        employee.address,

                        // Mandapam
                        // $13 - $18
                        mandapam_name.trim(),
                        landmark.trim(),
                        mandapam_address.trim(),
                        mandapam_village_town.trim(),
                        mandapam_mandal.trim(),
                        district.trim(),

                        // Dates
                        // $19 - $21
                        installation_date,
                        festival_start_date,
                        festival_end_date,

                        // Times
                        // $22 - $23
                        daily_start_time,
                        daily_end_time,

                        // Numbers
                        // $24 - $25
                        expectedVisitorsValue,
                        idolHeightValue,

                        // Boolean
                        // $26 - $29
                        soundSystemRequired,
                        electricalConnectionRequired,
                        generatorRequired,
                        processionRequired,

                        // Other mandapam
                        // $30 - $31
                        place_of_mandapam.trim(),
                        special_event_details.trim(),

                        // Nimarjanam
                        // $32 - $33
                        nimarjanam_date,
                        nimarjanam_location.trim(),

                        // Yatra
                        // $34 - $35
                        shobha_yatra_start_time,
                        shobha_yatra_end_time,

                        // Cultural events
                        // $36 - $38
                        JSON.stringify(
                            culturalEvents
                        ),
                        specify_other_cultural_event.trim(),
                        additional_nimarjanam_details.trim(),

                        // GPS
                        // $39 - $40
                        latitudeValue,
                        longitudeValue,

                        // MinIO
                        // $41
                        locationPhotoPath,

                        // Status
                        // $42
                        "PENDING"
                    ]
                );

            const event =
                eventResult.rows[0];

            // --------------------------------------------------
            // 20. Commit transaction
            // --------------------------------------------------

            await client.query(
                "COMMIT"
            );

            // --------------------------------------------------
            // 21. Return response
            // --------------------------------------------------

            return res.status(201).json({

                message:
                    "Event permission request created successfully",

                data: {
                    event_id:
                        event.id,

                    empid:
                        event.empid,

                    committee_name:
                        event.committee_name,

                    leader_name:
                        event.leader_name,

                    email:
                        event.email,

                    mandapam_name:
                        event.mandapam_name,

                    district:
                        event.district,

                    location: {
                        latitude:
                            event.latitude,

                        longitude:
                            event.longitude
                    },

                    location_photo:
                        event.location_photo_path,

                    status:
                        event.status,

                    created_at:
                        event.created_at
                }
            });

        } catch (error) {

            // --------------------------------------------------
            // Rollback
            // --------------------------------------------------

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (
                rollbackError
            ) {
                console.error(
                    "Rollback error:",
                    rollbackError
                );
            }

            console.error(
                "Create event error:",
                error
            );

            // --------------------------------------------------
            // Foreign key violation
            // --------------------------------------------------

            if (
                error.code === "23503"
            ) {
                return res.status(400).json({
                    message:
                        "Invalid employee reference"
                });
            }

            // --------------------------------------------------
            // Invalid data
            // --------------------------------------------------

            if (
                error.code === "22P02"
            ) {
                return res.status(400).json({
                    message:
                        "Invalid data provided"
                });
            }

            return res.status(500).json({
                message:
                    "Internal server error"
            });

        } finally {

            client.release();
        }
    }
);
router.get("/getEvent", async (req, res) => {

    const {
        userId,
        date,
        status
    } = req.query;

    try {

        // ==================================================
        // 1. SPECIFIC USER
        //    Full event + employee + documents
        // ==================================================

        if (userId) {

            const conditions = [
                "e.empid = $1"
            ];

            const values = [
                userId
            ];

            let parameterIndex = 2;

            // --------------------------------------------------
            // Date filter
            // --------------------------------------------------

            if (date) {

                conditions.push(
                    `DATE(e.created_at) = $${parameterIndex}`
                );

                values.push(date);

                parameterIndex++;
            }

            // --------------------------------------------------
            // Status filter
            // --------------------------------------------------

            if (status) {

                conditions.push(
                    `e.status = $${parameterIndex}`
                );

                values.push(status);

                parameterIndex++;
            }

            const result = await pool.query(
                `
                SELECT

                    -- ==========================================
                    -- EVENT DETAILS
                    -- ==========================================

                    e.id AS event_id,
                    e.empid,

                    e.committee_name,
                    e.committee_registration_number,
                    e.committee_address,
                    e.committee_village_town,
                    e.committee_mandal,

                    e.leader_name,
                    e.mobile_number,
                    e.email,

                    e.id_proof_type,
                    e.id_proof_number,
                    e.residential_address,

                    -- ==========================================
                    -- MANDAPAM DETAILS
                    -- ==========================================

                    e.mandapam_name,
                    e.landmark,
                    e.mandapam_address,
                    e.mandapam_village_town,
                    e.mandapam_mandal,
                    e.district,

                    e.installation_date,
                    e.festival_start_date,
                    e.festival_end_date,

                    e.daily_start_time,
                    e.daily_end_time,

                    e.expected_visitors,
                    e.idol_height_ft,

                    e.sound_system_required,
                    e.electrical_connection_required,
                    e.generator_required,
                    e.procession_required,

                    e.place_of_mandapam,
                    e.special_event_details,

                    -- ==========================================
                    -- NIMARJANAM DETAILS
                    -- ==========================================

                    e.nimarjanam_date,
                    e.nimarjanam_location,

                    e.shobha_yatra_start_time,
                    e.shobha_yatra_end_time,

                    e.cultural_events_with_yatra,
                    e.specify_other_cultural_event,
                    e.additional_nimarjanam_details,

                    -- ==========================================
                    -- LOCATION
                    -- ==========================================

                    e.latitude,
                    e.longitude,
                    e.location_photo_path,

                    -- ==========================================
                    -- SYSTEM
                    -- ==========================================

                    e.police_station_id,
                    e.status,
                    e.created_at,
                    e.updated_at,

                    -- ==========================================
                    -- EMPLOYEE DETAILS
                    -- ==========================================

                    u.id AS user_id,
                    u.fullname AS user_fullname,
                    u.gender AS user_gender,
                    u.date_of_birth AS user_date_of_birth,
                    u.email AS user_email,
                    u.phonenumber AS user_phonenumber,
                    u.address AS user_address,

                    u.profile_pic_path,
                    u.aadhaar_image_path,
                    u.voter_id_image_path,
                    u.driving_license_image_path,

                    u.profile_completed,
                    u.profile_verified

                FROM events e

                INNER JOIN employees u
                    ON e.empid = u.id

                WHERE ${conditions.join(" AND ")}

                ORDER BY e.created_at DESC
                `,
                values
            );

            // --------------------------------------------------
            // No requests
            // --------------------------------------------------

            if (result.rows.length === 0) {

                return res.status(404).json({
                    message:
                        "No event requests found"
                });
            }

            // --------------------------------------------------
            // MinIO bucket
            // --------------------------------------------------

            const bucketName =
                process.env.MINIO_BUCKET || "events";

            // --------------------------------------------------
            // Generate URLs
            // --------------------------------------------------

            const events =
                await Promise.all(
                    result.rows.map(
                        async (event) => {

                            let profilePicUrl = null;
                            let aadhaarUrl = null;
                            let voterIdUrl = null;
                            let drivingLicenseUrl = null;
                            let locationPhotoUrl = null;

                            // ==================================
                            // PROFILE PICTURE
                            // ==================================

                            if (
                                event.profile_pic_path
                            ) {

                                try {

                                    profilePicUrl =
                                        await minioClient.presignedGetObject(
                                            bucketName,
                                            event.profile_pic_path,
                                            60 * 60
                                        );

                                } catch (error) {

                                    console.error(
                                        "Profile picture URL error:",
                                        error
                                    );
                                }
                            }

                            // ==================================
                            // AADHAAR
                            // ==================================

                            if (
                                event.aadhaar_image_path
                            ) {

                                try {

                                    aadhaarUrl =
                                        await minioClient.presignedGetObject(
                                            bucketName,
                                            event.aadhaar_image_path,
                                            60 * 60
                                        );

                                } catch (error) {

                                    console.error(
                                        "Aadhaar URL error:",
                                        error
                                    );
                                }
                            }

                            // ==================================
                            // VOTER ID
                            // ==================================

                            if (
                                event.voter_id_image_path
                            ) {

                                try {

                                    voterIdUrl =
                                        await minioClient.presignedGetObject(
                                            bucketName,
                                            event.voter_id_image_path,
                                            60 * 60
                                        );

                                } catch (error) {

                                    console.error(
                                        "Voter ID URL error:",
                                        error
                                    );
                                }
                            }

                            // ==================================
                            // DRIVING LICENCE
                            // ==================================

                            if (
                                event.driving_license_image_path
                            ) {

                                try {

                                    drivingLicenseUrl =
                                        await minioClient.presignedGetObject(
                                            bucketName,
                                            event.driving_license_image_path,
                                            60 * 60
                                        );

                                } catch (error) {

                                    console.error(
                                        "Driving Licence URL error:",
                                        error
                                    );
                                }
                            }

                            // ==================================
                            // LOCATION PHOTO
                            // ==================================

                            if (
                                event.location_photo_path
                            ) {

                                try {

                                    locationPhotoUrl =
                                        await minioClient.presignedGetObject(
                                            bucketName,
                                            event.location_photo_path,
                                            60 * 60
                                        );

                                } catch (error) {

                                    console.error(
                                        "Location photo URL error:",
                                        error
                                    );
                                }
                            }

                            // ==================================
                            // COMPLETE RESPONSE
                            // ==================================

                            return {

                                // ==================================
                                // EVENT
                                // ==================================

                                event: {

                                    id:
                                        event.event_id,

                                    empid:
                                        event.empid,

                                    committee: {

                                        name:
                                            event.committee_name,

                                        registration_number:
                                            event.committee_registration_number,

                                        address:
                                            event.committee_address,

                                        village_town:
                                            event.committee_village_town,

                                        mandal:
                                            event.committee_mandal
                                    },

                                    applicant: {

                                        leader_name:
                                            event.leader_name,

                                        mobile_number:
                                            event.mobile_number,

                                        email:
                                            event.email,

                                        id_proof_type:
                                            event.id_proof_type,

                                        id_proof_number:
                                            event.id_proof_number,

                                        residential_address:
                                            event.residential_address
                                    },

                                    mandapam: {

                                        name:
                                            event.mandapam_name,

                                        landmark:
                                            event.landmark,

                                        address:
                                            event.mandapam_address,

                                        village_town:
                                            event.mandapam_village_town,

                                        mandal:
                                            event.mandapam_mandal,

                                        district:
                                            event.district,

                                        installation_date:
                                            event.installation_date,

                                        festival_start_date:
                                            event.festival_start_date,

                                        festival_end_date:
                                            event.festival_end_date,

                                        daily_start_time:
                                            event.daily_start_time,

                                        daily_end_time:
                                            event.daily_end_time,

                                        expected_visitors:
                                            event.expected_visitors,

                                        idol_height_ft:
                                            event.idol_height_ft,

                                        sound_system_required:
                                            event.sound_system_required,

                                        electrical_connection_required:
                                            event.electrical_connection_required,

                                        generator_required:
                                            event.generator_required,

                                        procession_required:
                                            event.procession_required,

                                        place:
                                            event.place_of_mandapam,

                                        special_event_details:
                                            event.special_event_details
                                    },

                                    nimarjanam: {

                                        date:
                                            event.nimarjanam_date,

                                        location:
                                            event.nimarjanam_location,

                                        shobha_yatra_start_time:
                                            event.shobha_yatra_start_time,

                                        shobha_yatra_end_time:
                                            event.shobha_yatra_end_time,

                                        cultural_events:
                                            event.cultural_events_with_yatra,

                                        other_cultural_event:
                                            event.specify_other_cultural_event,

                                        additional_details:
                                            event.additional_nimarjanam_details
                                    },

                                    location: {

                                        latitude:
                                            event.latitude,

                                        longitude:
                                            event.longitude,

                                        photo:
                                            locationPhotoUrl
                                    },

                                    police_station_id:
                                        event.police_station_id,

                                    status:
                                        event.status,

                                    created_at:
                                        event.created_at,

                                    updated_at:
                                        event.updated_at
                                },

                                // ==================================
                                // REGISTERED USER
                                // ==================================

                                user: {

                                    id:
                                        event.user_id,

                                    fullname:
                                        event.user_fullname,

                                    gender:
                                        event.user_gender,

                                    date_of_birth:
                                        event.user_date_of_birth,

                                    email:
                                        event.user_email,

                                    phonenumber:
                                        event.user_phonenumber,

                                    address:
                                        event.user_address,

                                    profile_pic:
                                        profilePicUrl,

                                    documents: {

                                        aadhaar:
                                            aadhaarUrl,

                                        voter_id:
                                            voterIdUrl,

                                        driving_license:
                                            drivingLicenseUrl
                                    },

                                    profile_completed:
                                        event.profile_completed,

                                    profile_verified:
                                        event.profile_verified
                                }
                            };
                        }
                    )
                );

            return res.status(200).json({

                message:
                    "Event requests fetched successfully",

                count:
                    events.length,

                data:
                    events
            });
        }

        // ==================================================
        // 2. ALL EVENTS
        //    Lightweight response
        // ==================================================

        const conditions = [];
        const values = [];

        let parameterIndex = 1;

        // --------------------------------------------------
        // Date filter
        // --------------------------------------------------

        if (date) {

            conditions.push(
                `DATE(e.created_at) = $${parameterIndex}`
            );

            values.push(date);

            parameterIndex++;
        }

        // --------------------------------------------------
        // Status filter
        // --------------------------------------------------

        if (status) {

            conditions.push(
                `e.status = $${parameterIndex}`
            );

            values.push(status);

            parameterIndex++;
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const result = await pool.query(
            `
            SELECT

                e.id AS event_id,
                e.empid,

                e.committee_name,
                e.committee_village_town,
                e.committee_mandal,

                e.leader_name,

                e.mandapam_name,
                e.mandapam_village_town,
                e.mandapam_mandal,
                e.district,

                e.installation_date,
                e.festival_start_date,
                e.festival_end_date,

                e.expected_visitors,
                e.idol_height_ft,

                e.place_of_mandapam,

                e.nimarjanam_date,
                e.nimarjanam_location,

                e.latitude,
                e.longitude,

                e.police_station_id,
                e.status,

                e.created_at

            FROM events e

            ${whereClause}

            ORDER BY e.created_at DESC
            `,
            values
        );

        // --------------------------------------------------
        // No events
        // --------------------------------------------------

        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "No event requests found"
            });
        }

        // --------------------------------------------------
        // Lightweight response
        // --------------------------------------------------

        const events =
            result.rows.map(
                (event) => ({

                    event_id:
                        event.event_id,

                    empid:
                        event.empid,

                    committee_name:
                        event.committee_name,

                    village_town:
                        event.committee_village_town,

                    mandal:
                        event.committee_mandal,

                    leader_name:
                        event.leader_name,

                    mandapam_name:
                        event.mandapam_name,

                    mandapam_village_town:
                        event.mandapam_village_town,

                    mandapam_mandal:
                        event.mandapam_mandal,

                    district:
                        event.district,

                    installation_date:
                        event.installation_date,

                    festival_start_date:
                        event.festival_start_date,

                    festival_end_date:
                        event.festival_end_date,

                    expected_visitors:
                        event.expected_visitors,

                    idol_height_ft:
                        event.idol_height_ft,

                    place_of_mandapam:
                        event.place_of_mandapam,

                    nimarjanam_date:
                        event.nimarjanam_date,

                    nimarjanam_location:
                        event.nimarjanam_location,

                    location: {

                        latitude:
                            event.latitude,

                        longitude:
                            event.longitude
                    },

                    police_station_id:
                        event.police_station_id,

                    status:
                        event.status,

                    created_at:
                        event.created_at
                })
            );

        return res.status(200).json({

            message:
                "Event requests fetched successfully",

            count:
                events.length,

            data:
                events
        });

    } catch (error) {

        console.error(
            "Get event error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error"
        });
    }
});
router.put(
    "/actionRequest",
  
    async (req, res) => {

        const {
            event_id,
            action,
            rejection_reason
        } = req.body;

        // --------------------------------------------------
        // 1. Get authenticated user
        // --------------------------------------------------

        const actionBy = req.user?.id;

        if (!actionBy) {
            return res.status(401).json({
                message:
                    "Authentication required"
            });
        }

        // --------------------------------------------------
        // 2. Validate required fields
        // --------------------------------------------------

        if (!event_id || !action) {
            return res.status(400).json({
                message:
                    "event_id and action are required"
            });
        }

        // --------------------------------------------------
        // 3. Validate action
        // --------------------------------------------------

        const cleanAction =
            action.trim().toUpperCase();

        if (
            cleanAction !== "APPROVED" &&
            cleanAction !== "REJECTED"
        ) {
            return res.status(400).json({
                message:
                    "Invalid action. Use APPROVED or REJECTED"
            });
        }

        // --------------------------------------------------
        // 4. Rejection reason
        // --------------------------------------------------

        if (
            cleanAction === "REJECTED" &&
            (
                !rejection_reason ||
                rejection_reason.trim() === ""
            )
        ) {
            return res.status(400).json({
                message:
                    "rejection_reason is required when rejecting a request"
            });
        }

        try {

            // --------------------------------------------------
            // 5. Find event
            // --------------------------------------------------

            const eventResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        empid,
                        status
                    FROM events
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [event_id]
                );

            if (
                eventResult.rows.length === 0
            ) {
                return res.status(404).json({
                    message:
                        "Event request not found"
                });
            }

            const event =
                eventResult.rows[0];

            // --------------------------------------------------
            // 6. Prevent duplicate action
            // --------------------------------------------------

            if (
                event.status === "APPROVED" ||
                event.status === "REJECTED"
            ) {
                return res.status(400).json({
                    message:
                        `Request is already ${event.status.toLowerCase()}`
                });
            }

            // --------------------------------------------------
            // 7. Update request
            // --------------------------------------------------

            const result =
                await pool.query(
                    `
                    UPDATE events
                    SET
                        status = $1,
                        rejection_reason = $2,
                        action_by = $3,
                        action_at = NOW(),
                        updated_at = NOW()

                    WHERE id = $4

                    RETURNING
                        id,
                        empid,
                        status,
                        rejection_reason,
                        action_by,
                        action_at,
                        updated_at
                    `,
                    [
                        cleanAction,

                        cleanAction === "REJECTED"
                            ? rejection_reason.trim()
                            : null,

                        actionBy,

                        event_id
                    ]
                );

            if (
                result.rows.length === 0
            ) {
                return res.status(500).json({
                    message:
                        "Failed to update event request"
                });
            }

            const updatedRequest =
                result.rows[0];

            // --------------------------------------------------
            // 8. Success
            // --------------------------------------------------

            return res.status(200).json({

                message:
                    cleanAction === "APPROVED"
                        ? "Event request approved successfully"
                        : "Event request rejected successfully",

                data: {

                    event_id:
                        updatedRequest.id,

                    empid:
                        updatedRequest.empid,

                    status:
                        updatedRequest.status,

                    rejection_reason:
                        updatedRequest.rejection_reason,

                    action_by:
                        updatedRequest.action_by,

                    action_at:
                        updatedRequest.action_at,

                    updated_at:
                        updatedRequest.updated_at
                }
            });

        } catch (error) {

            console.error(
                "Action request error:",
                error
            );

            return res.status(500).json({
                message:
                    "Internal server error"
            });
        }
    }
);
module.exports=router