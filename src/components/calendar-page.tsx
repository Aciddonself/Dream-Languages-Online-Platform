"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import FullCalendar from "@fullcalendar/react";
import type { CalendarApi, CalendarOptions, CalendarRef, EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import interactionPlugin from "@fullcalendar/react/interaction";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/forma/theme.css";

type CalendarView = "Month" | "Week" | "Day" | "List";
type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
};

const views: { label: CalendarView; calendarView: string }[] = [
  { label: "Month", calendarView: "dayGridMonth" },
  { label: "Week", calendarView: "timeGridWeek" },
  { label: "Day", calendarView: "timeGridDay" },
  { label: "List", calendarView: "listWeek" },
];
const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

export function CalendarPage({ events }: { events: CalendarEvent[] }) {
  const calendarRef = useRef<CalendarRef | null>(null);
  const [view, setView] = useState<CalendarView>("Month");
  const [heading, setHeading] = useState(() => new Date().toLocaleDateString("en-UG", { month: "long", year: "numeric" }));
  const calendarEvents = useMemo<EventInput[]>(() => events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startsAt,
    end: event.endsAt,
    backgroundColor: "#eaf4f7",
    borderColor: "#2e7794",
    textColor: "#245469",
    extendedProps: { room: event.room },
  })), [events]);

  function calendarApi(): CalendarApi | undefined {
    return calendarRef.current?.getApi();
  }

  function changeView(nextView: CalendarView) {
    const target = views.find((item) => item.label === nextView);
    if (!target) return;
    setView(nextView);
    calendarApi()?.changeView(target.calendarView);
  }

  const options = useMemo<CalendarOptions>(() => ({
    plugins,
    initialView: "dayGridMonth",
    headerToolbar: false,
    height: "auto",
    events: calendarEvents,
    weekends: true,
    nowIndicator: true,
    dayMaxEvents: 3,
    eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
    eventDisplay: "block",
    datesSet: ({ view: calendarView }) => setHeading(calendarView.title),
    eventClassNames: ["calendar-fc-event"],
    eventContent: ({ timeText, event }) => (
      <span className="calendar-fc-event-content">
        {timeText && <span className="calendar-fc-event-time">{timeText}</span>}
        <strong>{event.title}</strong>
        {event.extendedProps.room && <span className="calendar-fc-event-room">{event.extendedProps.room}</span>}
      </span>
    ),
  }), [calendarEvents]);

  return (
    <section className="calendar-app">
      <div className="calendar-toolbar">
        <div className="calendar-heading">
          <span className="portal-eyebrow">DLA Learning Hub</span>
          <h1>{heading}</h1>
        </div>
        <div className="calendar-actions">
          <div className="calendar-view-switch" role="tablist" aria-label="Calendar view">
            {views.map((item) => (
              <button key={item.label} type="button" role="tab" aria-selected={view === item.label} onClick={() => changeView(item.label)}>
                {item.label}
              </button>
            ))}
          </div>
          <Link href="/admin/academic" className="calendar-add-button">
            <Plus size={16} />
            <span>Schedule</span>
          </Link>
        </div>
      </div>

      <div className="calendar-navigation">
        <div className="calendar-month-nav">
          <button type="button" className="calendar-arrow" aria-label="Previous period" onClick={() => calendarApi()?.prev()}><ChevronLeft size={17} /></button>
          <button type="button" className="calendar-arrow" aria-label="Next period" onClick={() => calendarApi()?.next()}><ChevronRight size={17} /></button>
          <button type="button" className="calendar-today" onClick={() => calendarApi()?.today()}>Today</button>
        </div>
        <div className="calendar-legend"><span /> Class session</div>
      </div>

      <div className="calendar-frame">
        <FullCalendar ref={calendarRef} {...options} />
      </div>
      <p className="calendar-note">Only scheduled class times are displayed here. Session join links are not exposed in the calendar.</p>
    </section>
  );
}
