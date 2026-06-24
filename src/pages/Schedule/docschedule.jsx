// import React, {
//   useEffect,
//   useState,
// } from "react";

// import "./docschedule.css";

// import {
//   Trash2,
//   Plus,
//   Save,
// } from "lucide-react";

// /* ================= API ================= */

// const API =
//   "/api/ScheduleSettings";

// /* ================= COMPONENT ================= */

// function Doctorschedulepage() {

//   /* SETTINGS */

//   const [slotDuration, setSlotDuration] =
//     useState(30);

//   const [clinicOpen, setClinicOpen] =
//     useState("09:00");

//   const [clinicClose, setClinicClose] =
//     useState("18:00");

//   /* HOLIDAYS */

//   const [holidays, setHolidays] =
//     useState([]);

//   const [loading, setLoading] =
//     useState(false);

//   const [newHoliday, setNewHoliday] =
//     useState({
//       name: "",
//       date: "",
//     });

//   /* ================= LOAD ================= */

//   useEffect(() => {

//     fetchSettings();

//     fetchHolidays();

//   }, []);

//   /* ================= GET SETTINGS ================= */

//   const fetchSettings = async () => {

//     try {

//       const response =
//         await fetch(API, {
//           headers: {
//             "ngrok-skip-browser-warning":
//               "true",
//           },
//         });

//       if (!response.ok) return;

//       const data =
//         await response.json();

//       console.log(
//         "SETTINGS:",
//         data
//       );

//       setSlotDuration(
//         data.slotDuration || 30
//       );

//       setClinicOpen(
//         data.clinicOpen?.slice(0, 5) ||
//         "09:00"
//       );

//       setClinicClose(
//         data.clinicClose?.slice(0, 5) ||
//         "18:00"
//       );

//     } catch (error) {

//       console.log(error);

//     }
//   };

//   /* ================= GET HOLIDAYS ================= */

//   const fetchHolidays = async () => {

//     try {

//       setLoading(true);

//       const response =
//         await fetch(
//           `${API}/holidays`,
//           {
//             headers: {
//               "ngrok-skip-browser-warning":
//                 "true",
//             },
//           }
//         );

//       const data =
//         await response.json();

//       console.log(
//         "HOLIDAYS:",
//         data
//       );

//       setHolidays(
//         Array.isArray(data)
//           ? data
//           : []
//       );

//     } catch (error) {

//       console.log(
//         "HOLIDAY ERROR:",
//         error
//       );

//     } finally {

//       setLoading(false);

//     }
//   };

//   /* ================= SAVE SETTINGS ================= */

//   const saveSettings = async () => {

//     try {

//       await fetch(API, {
//         method: "POST",

//         headers: {
//           "Content-Type":
//             "application/json",

//           "ngrok-skip-browser-warning":
//             "true",
//         },

//         body: JSON.stringify({
//           slotDuration:
//             Number(slotDuration),

//           clinicOpen:
//             `${clinicOpen}:00`,

//           clinicClose:
//             `${clinicClose}:00`,
//         }),
//       });

//       alert(
//         "Settings saved successfully"
//       );

//     } catch (error) {

//       console.log(error);

//     }
//   };

//   /* ================= ADD HOLIDAY ================= */

//   const addHoliday = async () => {

//     if (
//       !newHoliday.name ||
//       !newHoliday.date
//     ) {
//       return;
//     }

//     try {

//       await fetch(
//         `${API}/holidays`,
//         {
//           method: "POST",

//           headers: {
//             "Content-Type":
//               "application/json",

//             "ngrok-skip-browser-warning":
//               "true",
//           },

//           body: JSON.stringify({
//             name:
//               newHoliday.name,

//             date:
//               newHoliday.date,
//           }),
//         }
//       );

//       setNewHoliday({
//         name: "",
//         date: "",
//       });

//       fetchHolidays();

//     } catch (error) {

//       console.log(error);

//     }
//   };

//   /* ================= DELETE ================= */

//   const removeHoliday =
//     async (id) => {

//       try {

//         await fetch(
//           `${API}/holidays/${id}`,
//           {
//             method: "DELETE",

//             headers: {
//               "ngrok-skip-browser-warning":
//                 "true",
//             },
//           }
//         );

//         fetchHolidays();

//       } catch (error) {

//         console.log(error);

//       }
//     };

//   return (

//     <div className="schedule-page">

//       {/* HEADER */}

//       <div className="page-header">

//         <h2>
//           Schedule Settings
//         </h2>

//         <p>
//           Global clinic-wide
//           scheduling configuration
//         </p>

//       </div>

//       <div className="schedule-grid">

//         {/* LEFT CARD */}

//         <div className="card">

//           <h3>General</h3>

//           {/* SLOT */}

//           <label>
//             Default Slot Duration
//           </label>

//           <select
//             className="input"
//             value={slotDuration}
//             onChange={(e) =>
//               setSlotDuration(
//                 e.target.value
//               )
//             }
//           >

//             <option value={15}>
//               15 minutes
//             </option>

//             <option value={20}>
//               20 minutes
//             </option>

//             <option value={30}>
//               30 minutes
//             </option>

//             <option value={45}>
//               45 minutes
//             </option>

//             <option value={60}>
//               60 minutes
//             </option>

//           </select>

//           {/* TIME */}

//           <div className="time-row">

//             <div>

//               <label>
//                 Clinic Opens
//               </label>

//               <input
//                 type="time"
//                 className="input"
//                 value={clinicOpen}
//                 onChange={(e) =>
//                   setClinicOpen(
//                     e.target.value
//                   )
//                 }
//               />

//             </div>

//             <div>

//               <label>
//                 Clinic Closes
//               </label>

//               <input
//                 type="time"
//                 className="input"
//                 value={clinicClose}
//                 onChange={(e) =>
//                   setClinicClose(
//                     e.target.value
//                   )
//                 }
//               />

//             </div>

//           </div>

//           {/* SAVE */}

//           <button
//             className="btn save"
//             onClick={
//               saveSettings
//             }
//           >

//             <Save size={16} />

//             Save Settings

//           </button>

//         </div>

//         {/* RIGHT CARD */}

//         <div className="card">

//           <div className="holiday-header">

//             <h3>
//               Holidays
//             </h3>

//             <span>
//               {
//                 holidays.length
//               }{" "}
//               configured
//             </span>

//           </div>

//           {/* HOLIDAY LIST */}

//           {loading ? (

//             <p
//               style={{
//                 marginTop: "15px",
//               }}
//             >
//               Loading...
//             </p>

//           ) : holidays.length >
//             0 ? (

//             holidays.map(
//               (holiday) => (

//                 <div
//                   className="holiday-item"
//                   key={holiday.id}
//                 >

//                   <div>

//                     <p className="holiday-name">
//                       {
//                         holiday.name
//                       }
//                     </p>

//                     <span className="holiday-date">
//                       {
//                         holiday.date
//                       }
//                     </span>

//                   </div>

//                   <Trash2
//                     size={18}
//                     className="delete"
//                     onClick={() =>
//                       removeHoliday(
//                         holiday.id
//                       )
//                     }
//                   />

//                 </div>
//               )
//             )
//           ) : (

//             <p
//               style={{
//                 marginTop: "15px",
//                 color: "#6b7280",
//               }}
//             >
//               No holidays found
//             </p>

//           )}

//           {/* ADD HOLIDAY */}

//           <div className="holiday-form">

//             <input
//               type="date"
//               value={
//                 newHoliday.date
//               }
//               onChange={(e) =>
//                 setNewHoliday({
//                   ...newHoliday,
//                   date:
//                     e.target
//                       .value,
//                 })
//               }
//             />

//             <input
//               placeholder="Holiday name"
//               value={
//                 newHoliday.name
//               }
//               onChange={(e) =>
//                 setNewHoliday({
//                   ...newHoliday,
//                   name:
//                     e.target
//                       .value,
//                 })
//               }
//             />

//             <button
//               onClick={
//                 addHoliday
//               }
//             >

//               <Plus size={18} />

//             </button>

//           </div>

//         </div>

//       </div>

//     </div>
//   );
// }

// export default Doctorschedulepage;



import React, {
  useEffect,
  useState,
} from "react";

import "./docschedule.css";

import {
  Trash2,
  Plus,
  Save,
  Pencil,
} from "lucide-react";
import { apiUrl } from "../../config/api";
import { useToast } from "../../components/ToastProvider";

/* ================= API ================= */

const API =
  apiUrl("ScheduleSettings");

/* ================= COMPONENT ================= */

function Doctorschedulepage() {
  const toast = useToast();

  /* SETTINGS */

  const [slotDuration, setSlotDuration] =
    useState(30);

  const [clinicOpen, setClinicOpen] =
    useState("09:00");

  const [clinicClose, setClinicClose] =
    useState("18:00");

  /* HOLIDAYS */

  const [holidays, setHolidays] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [newHoliday, setNewHoliday] =
    useState({
      name: "",
      date: "",
    });

  /* ================= LOAD ================= */

  useEffect(() => {

    fetchSettings();

    fetchHolidays();

  }, []);

  /* ================= GET SETTINGS ================= */

  const fetchSettings = async () => {

    try {

      const response =
        await fetch(API, {
          headers: {
            "ngrok-skip-browser-warning":
              "true",
          },
        });

      if (!response.ok) return;

      const data =
        await response.json();

      console.log(
        "SETTINGS:",
        data
      );

      setSlotDuration(
        data.slotDuration || 30
      );

      setClinicOpen(
        data.clinicOpen?.slice(0, 5) ||
        "09:00"
      );

      setClinicClose(
        data.clinicClose?.slice(0, 5) ||
        "18:00"
      );

    } catch (error) {

      console.log(error);

    }
  };

  /* ================= GET HOLIDAYS ================= */

  const fetchHolidays = async () => {

    try {

      setLoading(true);

      const response =
        await fetch(
          `${API}/holidays`,
          {
            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
          }
        );

      const data =
        await response.json();

      console.log(
        "HOLIDAYS:",
        data
      );

      setHolidays(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.log(
        "HOLIDAY ERROR:",
        error
      );

    } finally {

      setLoading(false);

    }
  };

  /* ================= SAVE SETTINGS ================= */

  const saveSettings = async () => {
    try {

      await fetch(API, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "ngrok-skip-browser-warning":
            "true",
        },

        body: JSON.stringify({
          slotDuration:
            Number(slotDuration),

          clinicOpen:
            `${clinicOpen}:00`,

          clinicClose:
            `${clinicClose}:00`,
        }),
      });

      toast.success(
        "Schedule settings saved successfully"
      );

    } catch (error) {

      console.log(error);
      toast.error(
        "Unable to save schedule settings."
      );

    }
  };

  /* ================= ADD HOLIDAY ================= */

  const addHoliday = async () => {
    if (
      !newHoliday.name ||
      !newHoliday.date
    ) {
      return;
    }

    try {

      await fetch(
        `${API}/holidays`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "ngrok-skip-browser-warning":
              "true",
          },

          body: JSON.stringify({
            name:
              newHoliday.name,

            date:
              newHoliday.date,
          }),
        }
      );

      setNewHoliday({
        name: "",
        date: "",
      });

      fetchHolidays();

    } catch (error) {

      console.log(error);

    }
  };

  /* ================= EDIT ================= */

  const editHoliday = (
    holiday
  ) => {
    setEditingId(
      holiday.id
    );

    setNewHoliday({
      name: holiday.name,
      date: holiday.date,
    });
  };

  /* ================= UPDATE ================= */

  const updateHoliday =
    async () => {
      try {

        await fetch(
          `${API}/holidays/${editingId}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              "ngrok-skip-browser-warning":
                "true",
            },

            body: JSON.stringify({
              name:
                newHoliday.name,

              date:
                `${newHoliday.date}T00:00:00`,
            }),
          }
        );

        setEditingId(null);

        setNewHoliday({
          name: "",
          date: "",
        });

        fetchHolidays();

      } catch (error) {

        console.log(error);

      }
    };

  /* ================= DELETE ================= */

  const removeHoliday =
    async (id) => {
      try {

        await fetch(
          `${API}/holidays/${id}`,
          {
            method: "DELETE",

            headers: {
              "ngrok-skip-browser-warning":
                "true",
            },
          }
        );

        fetchHolidays();

      } catch (error) {

        console.log(error);

      }
    };

  return (
    <div className="schedule-page">

      {/* HEADER */}

      <div className="page-header">

        <h2>
          Schedule Settings
        </h2>

        <p>
          Global clinic-wide
          scheduling configuration
        </p>

      </div>

      <div className="schedule-grid">

        {/* LEFT CARD */}

        <div className="card">

          <h3>General</h3>

          {/* SLOT */}

          <label>
            Default Slot Duration
          </label>

          <select
            className="input"
            value={slotDuration}
            onChange={(e) =>
              setSlotDuration(
                e.target.value
              )
            }
          >

            <option value={15}>
              15 minutes
            </option>

            <option value={20}>
              20 minutes
            </option>

            <option value={30}>
              30 minutes
            </option>

            <option value={45}>
              45 minutes
            </option>

            <option value={60}>
              60 minutes
            </option>

          </select>

          {/* TIME */}

          <div className="time-row">

            <div>

              <label>
                Clinic Opens
              </label>

              <input
                type="time"
                className="input"
                value={clinicOpen}
                onChange={(e) =>
                  setClinicOpen(
                    e.target.value
                  )
                }
              />

            </div>

            <div>

              <label>
                Clinic Closes
              </label>

              <input
                type="time"
                className="input"
                value={clinicClose}
                onChange={(e) =>
                  setClinicClose(
                    e.target.value
                  )
                }
              />

            </div>

          </div>

          {/* SAVE */}

          <button
            className="btn save"
            onClick={
              saveSettings
            }
          >

            <Save size={16} />

            Save Settings

          </button>

        </div>

        {/* RIGHT CARD */}

        <div className="card">

          <div className="holiday-header">

            <h3>
              Holidays
            </h3>

            <span>
              {
                holidays.length
              }{" "}
              configured
            </span>

          </div>

          {/* HOLIDAY LIST */}

          {loading ? (

            <p
              style={{
                marginTop: "15px",
              }}
            >
              Loading...
            </p>

          ) : holidays.length >
            0 ? (

            holidays.map(
              (holiday) => (

                <div
                  className="holiday-item"
                  key={holiday.id}
                >

                  <div>

                    <p className="holiday-name">
                      {
                        holiday.name
                      }
                    </p>

                    <span className="holiday-date">
                      {
                        holiday.date
                      }
                    </span>

                  </div>

                  {/* ACTIONS */}

                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: "12px",
                    }}
                  >

                    {/* EDIT */}

                    <Pencil
                      size={18}
                      style={{
                        cursor:
                          "pointer",
                        color:
                          "#0f9d9d",
                      }}
                      onClick={() =>
                        editHoliday(
                          holiday
                        )
                      }
                    />

                    {/* DELETE */}

                    <Trash2
                      size={18}
                      className="delete"
                      onClick={() =>
                        removeHoliday(
                          holiday.id
                        )
                      }
                    />

                  </div>

                </div>
              )
            )
          ) : (

            <p
              style={{
                marginTop: "15px",
                color:
                  "#6b7280",
              }}
            >
              No holidays found
            </p>

          )}

          {/* ADD / UPDATE HOLIDAY */}

          <div className="holiday-form">

            <input
              type="date"
              value={
                newHoliday.date
              }
              onChange={(e) =>
                setNewHoliday({
                  ...newHoliday,
                  date:
                    e.target
                      .value,
                })
              }
            />

            <input
              placeholder="Holiday name"
              value={
                newHoliday.name
              }
              onChange={(e) =>
                setNewHoliday({
                  ...newHoliday,
                  name:
                    e.target
                      .value,
                })
              }
            />

            <button
              onClick={
                editingId
                  ? updateHoliday
                  : addHoliday
              }
            >

              {editingId ? (
                <Pencil size={18} />
              ) : (
                <Plus size={18} />
              )}

            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

export default Doctorschedulepage;
