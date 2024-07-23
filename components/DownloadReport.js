// components/DownloadReport.js
import React from 'react';
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import 'jspdf-autotable';

const colors = [
  "rgba(255, 99, 132, 0.5)",  // red
  "rgba(54, 162, 235, 0.5)",  // blue
  "rgba(255, 206, 86, 0.5)",  // yellow
  "rgba(75, 192, 192, 0.5)",  // green
  "rgba(153, 102, 255, 0.5)", // purple
  "rgba(255, 159, 64, 0.5)"   // orange
];

const colorMapping = {};
const getColorForDevice = (deviceId) => {
  if (!colorMapping[deviceId]) {
    const index = Object.keys(colorMapping).length % colors.length;
    colorMapping[deviceId] = colors[index];
  }
  return colorMapping[deviceId];
};

const rgbaToRgb = (rgba) => {
  const match = rgba.match(/rgba?\((\d+), (\d+), (\d+)/);
  if (match) {
    const [, r, g, b] = match;
    return [parseInt(r, 10), parseInt(g, 10), parseInt(b, 10)];
  }
  return [0, 0, 0];
};

const DownloadReport = ({ deviceInsights, devicePings, startDate, endDate }) => {
  const handleDownload = async () => {
    const zip = new JSZip();
    const currentDate = new Date().toISOString().slice(0, 10);
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });
    const pageHeight = pdf.internal.pageSize.height;

    pdf.setFontSize(16);
    pdf.text('WBM Manager\'s Report', 105, 20, null, null, 'center');
    pdf.setFontSize(12);
    pdf.text(`Date Range: ${startDate} to ${endDate}`, 105, 30, null, null, 'center');
    pdf.setLineWidth(0.5);
    pdf.line(20, 35, 190, 35);

    const chart = document.querySelector('canvas');
    if (chart) {
      const chartImg = chart.toDataURL('image/png');
      pdf.addImage(chartImg, 'PNG', 15, 40, 180, 90);
    }

    let yPos = 140;

    pdf.autoTable({
      startY: yPos,
      head: [['Device ID', 'Total Pings', 'Times Emptied', 'Average Fill Rate', 'Out of Range', 'Sudden Changes']],
      body: Object.entries(deviceInsights).map(([id, insight]) => [
        id,
        insight.totalPings,
        insight.emptyingEvents,
        insight.averageFillRate.toFixed(2),
        insight.commonAnomalies.length,
        Object.entries(insight.frequentSuddenChangesSummary).length
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [74, 85, 104],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      margin: { top: 140 },
      didDrawCell: (data) => {
        if (data.column.index === 0) {
          const id = data.cell.raw;
          const color = getColorForDevice(id);
          const [r, g, b] = rgbaToRgb(color);
          pdf.setFillColor(r, g, b);
          pdf.rect(data.cell.x - 2, data.cell.y, 2, data.cell.height, 'F');
        }
      }
    });

    yPos = pdf.lastAutoTable.finalY + 10;

    Object.keys(deviceInsights).forEach((id) => {
      const { commonAnomalies, frequentSuddenChangesSummary } = deviceInsights[id];
      if (yPos >= pageHeight - 20) {
        pdf.addPage();
        yPos = 20;
      }

      if (commonAnomalies.length > 0) {
        pdf.setFontSize(14);
        pdf.text(`Device ${id} Out of Range Details:`, 15, yPos);
        yPos += 10;
        pdf.autoTable({
          startY: yPos,
          head: [['Level', 'Occurrences', 'Times']],
          body: commonAnomalies.map(anomaly => [anomaly.level, anomaly.occurrences, anomaly.times]),
          theme: 'grid',
          headStyles: {
            fillColor: [74, 85, 104],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          margin: { left: 15, right: 15 },
          tableWidth: 180,
          styles: {
            cellWidth: 'wrap',
            fontSize: 8,
            cellPadding: 1,
            overflow: 'linebreak',
          },
        });
        yPos = pdf.lastAutoTable.finalY + 10;
      }

      if (Object.entries(frequentSuddenChangesSummary).length > 0) {
        pdf.setFontSize(14);
        pdf.text(`Device ${id} Sudden Changes Details:`, 15, yPos);
        yPos += 10;
        pdf.autoTable({
          startY: yPos,
          head: [['Change', 'Details']],
          body: Object.entries(frequentSuddenChangesSummary).map(([change, times]) => [change, times.join(", ")]),
          theme: 'grid',
          headStyles: {
            fillColor: [74, 85, 104],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          margin: { left: 15, right: 15 },
          tableWidth: 180,
          styles: {
            cellWidth: 'wrap',
            fontSize: 8,
            cellPadding: 1,
            overflow: 'linebreak',
          },
        });
        yPos = pdf.lastAutoTable.finalY + 10;
      }

      pdf.setFontSize(10);
      pdf.text(`Page ${pdf.internal.getNumberOfPages()}`, 105, 287, null, null, 'center');
    });

    const csvRows = [
      ['Device ID', 'Total Pings', 'Times Emptied', 'Average Fill Rate', 'Out of Range', 'Sudden Changes'],
      ...Object.entries(deviceInsights).map(([id, insight]) => [
        id,
        insight.totalPings,
        insight.emptyingEvents,
        insight.averageFillRate.toFixed(2),
        insight.commonAnomalies.length,
        Object.entries(insight.frequentSuddenChangesSummary).length
      ])
    ];

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    zip.file(`WBM_Report_${currentDate}.csv`, csvString);

    const pdfBlob = pdf.output("blob");
    zip.file("WBM_Manager's_Report.pdf", pdfBlob);

    zip.generateAsync({ type: "blob" }).then(function (content) {
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "WBM_Report.zip";
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <button
      className="bg-green-500 text-white rounded px-4 py-2 text-lg transition duration-300 hover:bg-green-600"
      onClick={handleDownload}
    >
      Download Summary Data
    </button>
  );
};

export default DownloadReport;
