import React, { useState } from "react";

const schedules = [
  {
    id: 1,
    score: 92,
    breakdown: { gaps: 10, difficulty: 8 },
    classes: [
      { course: "CSE11", day: "Mon", start: 9, end: 10 },
      { course: "MATH20A", day: "Wed", start: 13, end: 14 },
      { course: "PHYS2A", day: "Fri", start: 11, end: 12 }
    ]
  },
  {
    id: 2,
    score: 78,
    breakdown: { gaps: 25, difficulty: 15 },
    classes: [
      { course: "CSE11", day: "Tue", start: 10, end: 11 },
      { course: "MATH20A", day: "Thu", start: 14, end: 15 },
      { course: "PHYS2A", day: "Mon", start: 8, end: 9 }
    ]
  }
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export default function ScheduleViewer() {
  const [index, setIndex] = useState(0);
  const schedule = schedules[index];

  return (
    <div style={{ padding: 20 }}>
      <h2>Schedule Option {schedule.id}</h2>
      <p><b>Total Score:</b> {schedule.score}</p>
      <p>Gap penalty: {schedule.breakdown.gaps}</p>
      <p>Difficulty penalty: {schedule.breakdown.difficulty}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setIndex((index - 1 + schedules.length) % schedules.length)}>Prev</button>
        <button onClick={() => setIndex((index + 1) % schedules.length)}>Next</button>
      </div>

      {/* Weekly Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "80px repeat(5, 1fr)", gap: 2 }}>
        <div></div>
        {days.map(d => <div key={d}><b>{d}</b></div>)}

        {Array.from({ length: 12 }).map((_, i) => {
          const hour = i + 8;
          return (
            <React.Fragment key={hour}>
              <div>{hour}:00</div>
              {days.map(day => {
                const cls = schedule.classes.find(c => c.day === day && c.start <= hour && c.end > hour);
                return (
                  <div key={day + hour} style={{
                    border: "1px solid #ddd",
                    height: 40,
                    background: cls ? "#90cdf4" : "white",
                    fontSize: 12,
                    padding: 2,
                    textAlign: "center"
                  }}>
                    {cls ? cls.course : ""}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
