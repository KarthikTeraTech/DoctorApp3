import express from 'express';
import con from '../models/db.js';
import { authorizeUser } from '../middlewares/authorize.js';
import { getCurrentDate, getCurrentTime } from '../utils/calendar.js';
import { bookEmergencyAppointment, bookNormalAppointment } from '../controllers/Appointments/BookAppointments.js';
const userRouter = express.Router();
import bcrypt from "bcryptjs";



// GET DOCTORS
userRouter.get("/getDoctors", authorizeUser, (req, res) => {
    const sql = "select * from doctors";

    con.query(sql, function (err, result) {
        if (err) return res.json({ success: false, msg: "Unexpected problem occurred while getting doctors" });

        else if (result.length > 0) return res.json({ success: true, data: result })

        else return res.json({ success: false, msg: "No Doctors Found" });
    })
});



//Get all of my appointments
userRouter.get("/getAllMyAppointments", authorizeUser, async (req, res) => {
    const sql = "select * from appointments where pemail = ?";

    con.query(sql, [[req.user.email]], function (err, myAllAppointments) {
        if (err) {
            return res.json({ success: false, msg: "Unexpected problem occurred while fetching appointments" });
        }
        else if (myAllAppointments.length > 0) {
            return res.status(200).json({ success: true, data: myAllAppointments })
        }
        else
            return res.json({ success: false, msg: "No Appointments Found" });
    })
});


// get today appointments
userRouter.get("/getTodayAppointments", authorizeUser, async (req, res) => {
    const sql = "select * from appointments where pemail = ? and appointmentDate = ?";
    const date = await getCurrentDate();

    con.query(sql, [[req.user.email], [date]], function (err, myTodayAppointments) {
        if (err) {
            return res.json({ success: false, msg: "Unexpected problem occurred while fetching appointments" });
        }
        else if (myTodayAppointments.length > 0) {
            return res.status(200).json({ success: true, data: myTodayAppointments })
        }
        else
            return res.json({ success: false, msg: "No Appointments Today" });
    })
})



// GET APPOINTMENTS
userRouter.get("/getAppointments", authorizeUser, async (req, res) => {
    const sql = "select * from appointments where pemail = ? and appointmentDate = ?";
    // and appointmentDate = ?
    const sql2 = "select * from appointments";
    const date = getCurrentDate();

    con.query(sql, [[req.user.email], [date]], function (err, myAllAppointments) {
        if (err) {
            return res.json({ success: false, msg: "Unexpected problem occurred while fetching appointments" });
        }
        else if (myAllAppointments.length > 0) {
            con.query(sql2, function (err, AllAppointments) {
                return res.status(200).json({ success: true, data: myAllAppointments })
                //getAppointmentTimings(res, myAllAppointments, req.user.email, AllAppointments);
            });
        }
        else
            return res.json({ success: false, msg: "No Appointments Today" });
    })
});


//GET USER DETAILS
userRouter.get("/getUserDetails", authorizeUser, async (req, res) => {
    const sql = "select name, email, phone from users where uid = ?"

    con.query(sql, [[req.user.uid]], (err, result) => {
        if (err)
            return res.json({ success: false, msg: "Internal Error Occurred" })

        else if (result.length > 0) {
            return res.json({ success: true, data: result[0] })
        }

        else return res.json({ success: false, msg: "No User Found" })
    })
})



//UPDATE USER DETAILS
userRouter.patch("/updateUserDetails", authorizeUser, async (req, res) => {
    const sql = "update users set phone = ? where uid = ?";
    const { phone } = req.body

    con.query(sql, [[phone], [req.user.uid]], function (err, result) {
        if (err)
            return res.json({ success: false, msg: "Internal Error Occurred" })

        else if (result.affectedRows >= 1) {
            return res.json({ success: true, msg: "Updated Successfully" })
        }

        else return res.json({ success: false, msg: "Error occurred while updating" })
    })
})



//UPDATE USER PASSWORD
userRouter.post("/updatePassword", authorizeUser, async (req, res) => {
    const sql = "select pass from users where uid = ?"
    const updateSql = "update users set pass = ? where uid = ?";
    const { old, newPass, confirm } = req.body;

    try {
        let salt = await bcrypt.genSalt(10);
        let hashedPass = await bcrypt.hash(confirm, salt);

        // verify old password
        con.query(sql, [[req.user.uid]], async function (err, result) {
            if (err)
                return res.json({ success: false, msg: "Internal Error Occurred" })

            else if (result[0]?.pass) {
                const isPassMatch = await bcrypt.compare(old, result[0]?.pass);
                if (isPassMatch && (newPass == confirm)) {
                    // update the password in db
                    con.query(updateSql, [[hashedPass], [req.user.uid]], function (err, result) {
                        if (err)
                            return res.json({ success: false, msg: "Internal Error Occurred" })

                        else if (result.affectedRows >= 1) {
                            return res.json({ success: true, msg: "Password updated successfully" })
                        }

                        else return res.json({ success: false, msg: "Error occurred while updating password" })
                    })
                }
                else return res.json({ success: false, msg: "Old Password is incorrect" })
            }
            else return res.json({ success: false, msg: "Invalid Passwords" })
        })
    }
    catch (err) {
        return res.status(400).json({ success: false, msg: "Internal Server Error Occurred" })
    }
})


// ************GET ESTIMATE APPOINTMENT TIMING FOR USER******************
userRouter.post("/getAppointmentTimings", authorizeUser, async (req, res) => {
    const { slot } = req.body;

    if (slot) {
        // const userAllAppSql = "select * from appointments where pemail = ? and appointmentDate = ? and slot = ?";
        const AllAppSql =
            "select * from appointments where appointmentDate = ? and slot = ? and (status = 0 or status = 1)";

        const email = req.user.email;
        const date = await getCurrentDate();
        const time = await getCurrentTime();

        let doctorIDsArr = [];
        let newAppointmentsArr = [];

        let hours = slot == "morning" ? 11 : 7;
        let minutes = slot == "morning" ? 0 : 30;

        if (slot == "morning" || slot == "evening") {
            if (time.hours >= hours) {
                hours = time.hours
                minutes = time.minutes
            }
        }

        try {
            const doctorIdSql = "select did from doctors";
            con.query(doctorIdSql, function (err, result) {
                if (err) return res.json({ success: false, msg: "Unexpected error occurred" })
                doctorIDsArr = result.length > 0 && result.map(obj => obj?.did);
            })

            con.query(AllAppSql, [[date], [slot]], async function (err, AllAppointmentsToday) {
                if (err) return res.json({ success: false, msg: "Unexpected error occurred" })
                else if (AllAppointmentsToday.length > 0) {
                    // getting appts. in Array of arrays of specific doctor
                    let newAppArrWithTimings = [];
                    doctorIDsArr.map((id, index) => {
                        newAppointmentsArr.push([]); //empty array for storing all apps of one doctor
                        AllAppointmentsToday.map(appointment => {
                            if (appointment.doctorID == id) {
                                newAppointmentsArr[index].push(appointment);
                            }
                        })
                    })

                    // timing logic
                    newAppointmentsArr.map(doctorArr => {
                        let updated_minutes = minutes;
                        let updated_hours = hours;

                        doctorArr.map((app, i) => {

                            let estimated_time = 0;
                            if (app[i - 1]?.appointmentType === 'normal' && i != 0)
                                estimated_time = 10;
                            else if (app[i - 1]?.appointmentType === 'emergency' && i != 0)
                                estimated_time = 20;
                            else if (app[i - 1]?.appointmentType === 'vaccination' && i != 0)
                                estimated_time = 5;
                            else
                                if (i != 0) estimated_time = 10;

                            updated_minutes += estimated_time;

                            if (updated_minutes >= 60) {
                                updated_hours++; // hours got incremented
                                updated_minutes = updated_minutes - 60; //to round clock again if minutes > 60
                            }

                            let hr = updated_hours <= 9 ? `0${updated_hours}` : updated_hours;
                            let min = updated_minutes <= 9 ? `0${updated_minutes}` : updated_minutes;
                            let time = `${hr}:${min}`

                            app = { ...app, time };

                            if (app.pemail == email) //pushing only particular user apps
                                newAppArrWithTimings.push(app);
                        })
                    })

                    return res.json({ success: true, newAppArrWithTimings })
                }
                else return res.json({ success: false, msg: "No Appointments Found" })
            })
        }
        catch (error) {
            return res.json({ success: false, msg: "Unexpected Error Occurred while fetching timings" });
        }
    }
})



//UPDATE APPOINTMENT
userRouter.post("/updateAppointment", authorizeUser, (req, res) => {
    const { pname, phone, appointmentType, id } = req.body.data;
    // const date = getCurrentDate(appointmentDate);

    const sql = `update appointments set pname = '${pname}', phone = '${phone}', appointmentType = '${appointmentType}' where id = '${id}'`;

    if (pname && phone && appointmentType && id) {
        con.query(sql, function (err, result) {
            if (err) return res.json({ success: false, msg: "Unexpected error occurred while updating appointment" });

            else if (result.affectedRows >= 1) return res.json({ success: true })

            else return res.json({ success: false, msg: "No Appointments Found" });
        })
    }
});



// BOOK AN APPOINTMENT
userRouter.post("/bookAppointment", authorizeUser, async (req, res) => {
    const { pname, phone, slot, AppointmentType, date, location } = req.body.data;

    const doctorID = req.body.id;
    const currentDate = await getCurrentDate(date);

    if (pname, req.user?.email, phone, slot, AppointmentType, doctorID, currentDate) {
        switch (AppointmentType) {
            case "emergency":
                bookEmergencyAppointment(req, res, currentDate, pname, req.user.email, phone, slot, doctorID, location);
                break;

            case "normal":
                bookNormalAppointment(req, res, currentDate, pname, req.user.email, phone, slot, doctorID, "normal", location);
                break;

            case "vaccination":
                bookNormalAppointment(req, res, currentDate, pname, req.user.email, phone, slot, doctorID, "vaccination", location);
                //passing type as vaccination but will be considered as normal, i.e passing in normalAppointment function as of now because normal and vaccination are same
                break;

            default:
                return res.json({ success: false, msg: "Invalid Appointment" });
        }
    }
    else return res.json({ success: false, msg: "Invalid Details" });
});



export default userRouter;