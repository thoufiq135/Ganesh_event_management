const express=require("express")
const router=express.Router()

const {connectDB,pool}=require("../DB/psql")
const multer=require("multer")
const {
    minioClient,
    connectMinio,
    uploadToMinio,
    getMinioUrl
}=require("../DB/minio")

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    }
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

        const client = await pool.connect();

        try {

            const {

                empid,

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


            // ==========================================
            // 1. VALIDATE REQUIRED FIELDS
            // ==========================================

            if (

                !empid ||

                !committee_name ||
                !committee_registration_number ||
                !committee_address ||
                !committee_village_town ||
                !committee_mandal ||

                !id_proof_type ||
                !id_proof_number ||

                !mandapam_name ||
                !landmark ||
                !mandapam_address ||
                !mandapam_village_town ||
                !mandapam_mandal ||
                !district ||

                !installation_date ||
                !festival_start_date ||
                !festival_end_date ||

                !daily_start_time ||
                !daily_end_time ||

                !expected_visitors ||
                !idol_height_ft ||

                sound_system_required === undefined ||
                electrical_connection_required === undefined ||
                generator_required === undefined ||
                procession_required === undefined ||

                !place_of_mandapam ||
                !special_event_details ||

                !nimarjanam_date ||
                !nimarjanam_location ||

                !shobha_yatra_start_time ||
                !shobha_yatra_end_time ||

                !cultural_events_with_yatra ||

                !latitude ||
                !longitude

            ) {

                return res.status(400).json({

                    message:
                        "All required event fields must be provided"

                });

            }


            // ==========================================
            // 2. CHECK LOCATION PHOTO
            // ==========================================

            const locationPhoto =
                req.files?.location_photo?.[0];


            if (!locationPhoto) {

                return res.status(400).json({

                    message:
                        "Location photo is required"

                });

            }


            // ==========================================
            // 3. START TRANSACTION
            // ==========================================

            await client.query("BEGIN");


            // ==========================================
            // 4. CHECK EMPLOYEE / REGISTERED USER
            // ==========================================

            const employeeResult =
                await client.query(
                    `
                    SELECT
                        id,
                        fullname,
                        email,
                        phonenumber,
                        address,

                        aadhaar_image_path,
                        voter_id_image_path,
                        driving_license_image_path,

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

                await client.query("ROLLBACK");

                return res.status(404).json({

                    message:
                        "Registered user not found"

                });

            }


            const employee =
                employeeResult.rows[0];


            // ==========================================
            // 5. CHECK PROFILE STATUS
            // ==========================================

            if (!employee.profile_verified) {

                await client.query("ROLLBACK");

                return res.status(403).json({

                    message:
                        "Please verify your email before creating an event"

                });

            }


            if (!employee.profile_completed) {

                await client.query("ROLLBACK");

                return res.status(403).json({

                    message:
                        "Please complete your profile before creating an event"

                });

            }


            // ==========================================
            // 6. VALIDATE EMPLOYEE DETAILS
            // ==========================================

            if (
                !employee.fullname ||
                !employee.phonenumber ||
                !employee.email ||
                !employee.address
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({

                    message:
                        "Registered user profile details are incomplete"

                });

            }


            // ==========================================
            // 7. UPLOAD LOCATION PHOTO TO MINIO
            // ==========================================

            const locationPhotoPath =
                await uploadToMinio(
                    locationPhoto,
                    "events/location-photos"
                );


            // ==========================================
            // 8. PARSE CULTURAL EVENTS
            // ==========================================

            let culturalEvents;


            try {

                if (
                    typeof cultural_events_with_yatra ===
                    "string"
                ) {

                    culturalEvents =
                        JSON.parse(
                            cultural_events_with_yatra
                        );

                } else {

                    culturalEvents =
                        cultural_events_with_yatra;

                }

            } catch (error) {

                await client.query("ROLLBACK");

                return res.status(400).json({

                    message:
                        "cultural_events_with_yatra must be valid JSON"

                });

            }


            // ==========================================
            // 9. INSERT EVENT
            // ==========================================

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

                        aadhaar_image_path,
                        voter_card_image_path,
                        driving_license_image_path,

                        location_photo_path,

                        status

                    )

                    VALUES (

                        $1,

                        $2, $3, $4, $5, $6,

                        $7, $8, $9,

                        $10, $11, $12,

                        $13, $14, $15, $16, $17, $18,

                        $19, $20, $21,

                        $22, $23,

                        $24, $25,

                        $26, $27, $28, $29,

                        $30, $31,

                        $32, $33,

                        $34, $35,

                        $36::jsonb,
                        $37,
                        $38,

                        $39,
                        $40,

                        $41,
                        $42,
                        $43,

                        $44,

                        'PENDING'

                    )

                    RETURNING
                        id,
                        empid,
                        committee_name,
                        leader_name,
                        mobile_number,
                        email,
                        status,
                        latitude,
                        longitude,
                        location_photo_path,
                        created_at
                    `,

                    [

                        // EMPLOYEE
                        empid,

                        // COMMITTEE
                        committee_name.trim(),
                        committee_registration_number.trim(),
                        committee_address.trim(),
                        committee_village_town.trim(),
                        committee_mandal.trim(),

                        // REGISTERED USER DETAILS
                        employee.fullname,
                        employee.phonenumber,
                        employee.email,

                        // ID PROOF
                        id_proof_type.trim(),
                        id_proof_number.trim(),
                        employee.address,

                        // MANDAPAM
                        mandapam_name.trim(),
                        landmark.trim(),
                        mandapam_address.trim(),
                        mandapam_village_town.trim(),
                        mandapam_mandal.trim(),
                        district.trim(),

                        // DATES
                        installation_date,
                        festival_start_date,
                        festival_end_date,

                        // DAILY TIME
                        daily_start_time,
                        daily_end_time,

                        // VISITORS / IDOL
                        Number(expected_visitors),
                        Number(idol_height_ft),

                        // REQUIREMENTS
                        sound_system_required === "true" ||
                        sound_system_required === true,

                        electrical_connection_required === "true" ||
                        electrical_connection_required === true,

                        generator_required === "true" ||
                        generator_required === true,

                        procession_required === "true" ||
                        procession_required === true,

                        // MANDAPAM DETAILS
                        place_of_mandapam.trim(),
                        special_event_details.trim(),

                        // NIMARJANAM
                        nimarjanam_date,
                        nimarjanam_location.trim(),

                        // YATRA
                        shobha_yatra_start_time,
                        shobha_yatra_end_time,

                        // CULTURAL EVENTS
                        JSON.stringify(culturalEvents),

                        specify_other_cultural_event
                            ? specify_other_cultural_event.trim()
                            : null,

                        additional_nimarjanam_details
                            ? additional_nimarjanam_details.trim()
                            : null,

                        // GPS
                        Number(latitude),
                        Number(longitude),

                        // USER DOCUMENTS FROM EMPLOYEE TABLE
                        employee.aadhaar_image_path,
                        employee.voter_id_image_path,
                        employee.driving_license_image_path,

                        // LOCATION IMAGE
                        locationPhotoPath

                    ]

                );


            // ==========================================
            // 10. COMMIT
            // ==========================================

            await client.query("COMMIT");


            const event =
                eventResult.rows[0];


            // ==========================================
            // 11. SUCCESS RESPONSE
            // ==========================================

            return res.status(201).json({

                message:
                    "Event request created successfully",

                data: event

            });


        } catch (error) {

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


            console.error(
                "Create event error:",
                error
            );


            if (
                error.code === "23505"
            ) {

                return res.status(400).json({

                    message:
                        "Duplicate event data"

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
    try {
        const { userId, date, status, id } = req.query;

        // ==================================================
        // 1. GET SPECIFIC EVENT BY EVENT ID
        // ==================================================

        if (id) {

            const eventResult = await pool.query(
                `
                SELECT
                    e.*,

                    emp.fullname,
                    emp.gender,
                    emp.date_of_birth,

                    emp.email AS employee_email,
                    emp.phonenumber AS employee_phonenumber,
                    emp.address AS employee_address,

                    emp.profile_pic_path,
                    emp.aadhaar_image_path,
                    emp.voter_id_image_path,
                    emp.driving_license_image_path,

                    emp.profile_completed,
                    emp.profile_verified

                FROM events e

                INNER JOIN employees emp
                    ON emp.id = e.empid

                WHERE e.id = $1

                LIMIT 1
                `,
                [id]
            );

            if (eventResult.rows.length === 0) {
                return res.status(404).json({
                    message: "Event not found"
                });
            }

            const event = eventResult.rows[0];

            // ==============================================
            // Generate MinIO URLs
            // ==============================================

            const profilePicUrl =
                event.profile_pic_path
                    ? await getMinioUrl(event.profile_pic_path)
                    : null;

            const aadhaarUrl =
                event.aadhaar_image_path
                    ? await getMinioUrl(event.aadhaar_image_path)
                    : null;

            const voterIdUrl =
                event.voter_id_image_path
                    ? await getMinioUrl(event.voter_id_image_path)
                    : null;

            const drivingLicenseUrl =
                event.driving_license_image_path
                    ? await getMinioUrl(
                        event.driving_license_image_path
                    )
                    : null;

            const locationPhotoUrl =
                event.location_photo_path
                    ? await getMinioUrl(
                        event.location_photo_path
                    )
                    : null;

            return res.status(200).json({
                message: "Event fetched successfully",

                data: formatFullEvent(
                    event,
                    {
                        profilePicUrl,
                        aadhaarUrl,
                        voterIdUrl,
                        drivingLicenseUrl,
                        locationPhotoUrl
                    }
                )
            });
        }

        // ==================================================
        // 2. GET FULL EVENT DETAILS BY USER ID
        // ==================================================

        if (userId) {

            const values = [userId];
            const conditions = [
                `e.empid = $1`
            ];

            // Optional date filter

            if (date) {

                values.push(date);

                conditions.push(
                    `DATE(e.created_at) = $${values.length}`
                );
            }

            // Optional status filter

            if (status) {

                values.push(
                    status.trim().toUpperCase()
                );

                conditions.push(
                    `e.status = $${values.length}`
                );
            }

            const eventResult = await pool.query(
                `
                SELECT
                    e.*,

                    emp.fullname,
                    emp.gender,
                    emp.date_of_birth,

                    emp.email AS employee_email,
                    emp.phonenumber AS employee_phonenumber,
                    emp.address AS employee_address,

                    emp.profile_pic_path,
                    emp.aadhaar_image_path,
                    emp.voter_id_image_path,
                    emp.driving_license_image_path,

                    emp.profile_completed,
                    emp.profile_verified

                FROM events e

                INNER JOIN employees emp
                    ON emp.id = e.empid

                WHERE ${conditions.join(" AND ")}

                ORDER BY e.created_at DESC
                `,
                values
            );

            // ==============================================
            // Generate full data for every event
            // ==============================================

            const fullEvents =
                await Promise.all(

                    eventResult.rows.map(
                        async (event) => {

                            const profilePicUrl =
                                event.profile_pic_path
                                    ? await getMinioUrl(
                                        event.profile_pic_path
                                    )
                                    : null;

                            const aadhaarUrl =
                                event.aadhaar_image_path
                                    ? await getMinioUrl(
                                        event.aadhaar_image_path
                                    )
                                    : null;

                            const voterIdUrl =
                                event.voter_id_image_path
                                    ? await getMinioUrl(
                                        event.voter_id_image_path
                                    )
                                    : null;

                            const drivingLicenseUrl =
                                event.driving_license_image_path
                                    ? await getMinioUrl(
                                        event.driving_license_image_path
                                    )
                                    : null;

                            const locationPhotoUrl =
                                event.location_photo_path
                                    ? await getMinioUrl(
                                        event.location_photo_path
                                    )
                                    : null;

                            return formatFullEvent(
                                event,
                                {
                                    profilePicUrl,
                                    aadhaarUrl,
                                    voterIdUrl,
                                    drivingLicenseUrl,
                                    locationPhotoUrl
                                }
                            );
                        }
                    )
                );

            return res.status(200).json({
                message:
                    "User event requests fetched successfully",

                count:
                    fullEvents.length,

                data:
                    fullEvents
            });
        }

        // ==================================================
        // 3. GET ALL EVENTS - BRIEF DATA
        // ==================================================

        const values = [];
        const conditions = [];

        if (date) {

            values.push(date);

            conditions.push(
                `DATE(e.created_at) = $${values.length}`
            );
        }

        if (status) {

            values.push(
                status.trim().toUpperCase()
            );

            conditions.push(
                `e.status = $${values.length}`
            );
        }

        const whereQuery =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const result = await pool.query(
            `
            SELECT
                e.id,
                e.empid,

                e.committee_name,
                e.mandapam_name,

                e.installation_date,

                e.festival_start_date,
                e.festival_end_date,

                e.expected_visitors,

                e.idol_height_ft,

                e.place_of_mandapam,

                e.status,

                e.created_at,

                emp.fullname AS leader_name,

                emp.phonenumber AS mobile_number,

                emp.email

            FROM events e

            INNER JOIN employees emp
                ON emp.id = e.empid

            ${whereQuery}

            ORDER BY
                e.created_at DESC
            `,
            values
        );

        return res.status(200).json({
            message:
                "Event requests fetched successfully",

            count:
                result.rows.length,

            data:
                result.rows
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


// ======================================================
// HELPER FUNCTION
// ======================================================

function formatFullEvent(event, urls) {

    return {

        event: {

            id:
                event.id,

            empid:
                event.empid,


            // ==========================================
            // COMMITTEE
            // ==========================================

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


            // ==========================================
            // APPLICANT
            // ==========================================

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


            // ==========================================
            // MANDAPAM
            // ==========================================

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

                place_of_mandapam:
                    event.place_of_mandapam,

                special_event_details:
                    event.special_event_details
            },


            // ==========================================
            // NIMARJANAM
            // ==========================================

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


            // ==========================================
            // LOCATION
            // ==========================================

            location: {

                latitude:
                    event.latitude,

                longitude:
                    event.longitude,

                photo:
                    urls.locationPhotoUrl
            },


            // ==========================================
            // POLICE ACTION
            // ==========================================

            police_station_id:
                event.police_station_id,

            status:
                event.status,

            police_remarks:
                event.police_remarks,

            action_by:
                event.action_by,

            action_at:
                event.action_at,

            created_at:
                event.created_at,

            updated_at:
                event.updated_at
        },


        // ==============================================
        // REGISTERED USER
        // ==============================================

        user: {

            id:
                event.empid,

            fullname:
                event.fullname,

            gender:
                event.gender,

            date_of_birth:
                event.date_of_birth,

            email:
                event.employee_email,

            phonenumber:
                event.employee_phonenumber,

            address:
                event.employee_address,


            // ==========================================
            // PROFILE IMAGE
            // ==========================================

            profile_pic:
                urls.profilePicUrl,


            // ==========================================
            // DOCUMENT IMAGES
            // ==========================================

            documents: {

                aadhaar:
                    urls.aadhaarUrl,

                voter_id:
                    urls.voterIdUrl,

                driving_license:
                    urls.drivingLicenseUrl
            },


            profile_completed:
                event.profile_completed,

            profile_verified:
                event.profile_verified
        }
    };
}
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

        const actionBy = 2;

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