Homeroom — Free Student Portal Dashboard Template by uiCookies
https://uicookies.com/

Homeroom is a free student and parent portal dashboard template for school
management systems, built on Bootstrap 5.3.8. It is the side students and
families log into, not the admin back office. Six pages cover a student's day:
a home screen with today's lessons on a clock-aware timeline, assignments with a
submission drawer, a report card with an SVG grade-trend chart, a weekly
timetable, a messages inbox and a parent view for fees, permission slips and
attendance. The look is warm and encouraging: indigo and coral, rounded Nunito
headings, Figtree body text and soft cards, with a light and a dark theme.
Everything runs on vanilla JavaScript with no jQuery.

WHAT'S INSIDE
  index.html            Student home: greeting, today's timeline, attendance ring,
                        work due this week, recent grades, announcements, events
  assignments.html      To do / Submitted / Graded tabs, subject filter, sort by due
                        date, detail drawer with rubric and file-drop submission
  grades.html           Report card by term with teacher comments, overall average
                        and a grade-trend line chart
  timetable.html        Weekly timetable with a day/week toggle and a live now line
  messages.html         Two-pane inbox with search, filters and a reply box
  parent.html           Parent view: child switcher, fees with a pay dialog,
                        permission slips, attendance alerts, contact a teacher
  css/vendor/           Bootstrap 5.3.8 (minified, self-hosted)
  css/style.css         Template design layer (tokens first, then components)
  js/vendor/            Bootstrap 5.3.8 bundle (includes Popper)
  js/main.js            Template behaviour: vanilla JavaScript, no jQuery
  img/                  Two public-domain demo photos
  CREDITS.txt           Sources and licences for the demo photos

NOTES
  - Built on Bootstrap 5.3.8. No jQuery, no chart library, no build step.
  - Colours, fonts, radii and layout sizes are CSS custom properties at the top
    of css/style.css. The dark theme has its own values under
    [data-bs-theme="dark"]. The theme toggle remembers the choice per browser.
  - Today's timeline and the timetable's now line follow the device clock.
    Outside school hours the demo runs at 10:25 so a live lesson is visible;
    set DEMO_TIME to null in js/main.js to always use the real clock.
  - Assignment briefs, rubrics and message threads are small data objects in
    js/main.js. The grade chart reads its numbers from the data table beneath
    it in grades.html, so edit the table and the chart follows.
  - Forms are front-end only: they validate in the browser and show a success
    state, but nothing is uploaded, sent or charged. Connect them to your
    backend, file storage or payment provider to make them live.
  - All names, grades and figures are fictional. Avatars are CSS initials, so
    there are no people photos to replace.
  - Everything stays readable without JavaScript: tabs show all their panels
    and both children appear on the parent page.

Free for personal and commercial use. Attribution is optional but always welcome — https://uicookies.com/license/
