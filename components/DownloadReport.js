// components/DownloadReport.js
import React from 'react';
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import 'jspdf-autotable';

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

    Object.keys(deviceInsights).forEach((id, index) => {
      const { commonAnomalies, frequentRapidChangesSummary } = deviceInsights[id];
      if (yPos >= 260) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setFontSize(14);
      pdf.text(`Device ${id} Insights:`, 15, yPos);
      yPos += 10;

      pdf.setFontSize(11);
      pdf.text(`Total Pings: ${devicePings[id]}`, 15, yPos);
      yPos += 10;

      pdf.setFontSize(11);
      pdf.text('Out of Range:', 15, yPos);
      yPos += 5;
      pdf.setFontSize(10);
      pdf.autoTable({
        startY: yPos,
        theme: 'grid',
        head: [['Level', 'Occurrences', 'Times']],
        body: deviceInsights[id].commonAnomalies.map(anomaly => [anomaly.level, anomaly.occurrences, anomaly.times]),
        margin: { left: 15, right: 15 },
        tableWidth: 180,
        styles: {
          cellWidth: 'wrap',
          fontSize: 8,
          cellPadding: 1,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [74, 85, 104],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 30 },
          2: { cellWidth: 110 }
        },
      });
      yPos = pdf.lastAutoTable.finalY + 10;

      if (yPos >= pageHeight - 20) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.text('Rapid Changes:', 15, yPos);
      yPos += 5;
      pdf.autoTable({
        startY: yPos,
        theme: 'grid',
        head: [['Change', 'Details']],
        body: Object.entries(deviceInsights[id].frequentRapidChangesSummary).map(([change, times]) => [change, times.join(", ")]),
        margin: { left: 15, right: 15 },
        tableWidth: 180,
        styles: {
          cellWidth: 'wrap',
          fontSize: 8,
          cellPadding: 1,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [74, 85, 104],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 120 }
        },
      });
      yPos = pdf.lastAutoTable.finalY + 10;

      pdf.setFontSize(10);
      pdf.text(`Page ${pdf.internal.getNumberOfPages()}`, 105, 287, null, null, 'center');

      const anomaliesData = commonAnomalies.map(anomaly => ({
        deviceId: id,
        type: 'Out of Range',
        detail: anomaly.level,
        occurrences: anomaly.occurrences,
        times: anomaly.times
      }));
      const changesData = Object.entries(frequentRapidChangesSummary).map(([change, times]) => ({
        deviceId: id,
        type: 'Rapid Change',
        detail: change,
        occurrences: times.length,
        times: times.join(", ")
      }));
      const combinedData = [...anomaliesData, ...changesData];
      const csvRows = ['Device ID,Type,Detail,Occurrences,Times'];
      combinedData.forEach(item => {
        csvRows.push(`${item.deviceId},${item.type},${item.detail},${item.occurrences},${item.times}`);
      });
      const csvString = csvRows.join('\n');
      zip.file(`Device_${id}_Insights_${currentDate}.csv`, csvString);
    });

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
