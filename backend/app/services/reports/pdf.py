import base64
import io
import json
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.project import Project
from app.models.trajectory import Trajectory
from app.models.well import Well


def generate_pdf_report(
    project: Project,
    well: Well,
    trajectory: Trajectory,
) -> tuple[str, bytes]:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("<b>Well Trajectory Report</b>", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Project: {project.name}", styles["Normal"]))
    story.append(Paragraph(f"Well: {well.name}", styles["Normal"]))
    story.append(Paragraph(f"Unit System: {well.unit_system}", styles["Normal"]))
    story.append(Paragraph(f"Survey Method: Minimum Curvature", styles["Normal"]))
    story.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", styles["Normal"]))
    story.append(Spacer(1, 20))

    if trajectory.survey_stations:
        data = [["MD", "Inc", "Azi", "TVD", "N/S", "E/W", "DLS"]]
        for s in trajectory.survey_stations:
            data.append([
                f"{s.md:.1f}", f"{s.inc:.2f}", f"{s.azi:.2f}",
                f"{s.tvd:.1f}", f"{s.ns:.1f}", f"{s.ew:.1f}", f"{s.dls:.2f}",
            ])
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
        ]))
        story.append(Paragraph("<b>Survey Stations</b>", styles["Heading2"]))
        story.append(Spacer(1, 8))
        story.append(table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    filename = f"{well.name.replace(' ', '_')}_trajectory_report.pdf"
    return filename, pdf_bytes
