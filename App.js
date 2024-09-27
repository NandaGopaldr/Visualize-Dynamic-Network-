import React, { useState, useEffect } from 'react';
import './App.css';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import networkgraph from 'highcharts/modules/networkgraph';
import Papa from 'papaparse';

networkgraph(Highcharts);

function App() {
  const [filesData, setFilesData] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');

  // Custom Highcharts network graph rendering
  useEffect(() => {
    (function (H) {
      H.wrap(H.seriesTypes.networkgraph.prototype.pointClass.prototype, 'getLinkPath', function (p) {
        var right = this.toNode,
          left = this.fromNode;

        var angle = Math.atan((left.plotX - right.plotX) / (left.plotY - right.plotY));

        if (angle) {
          let path = ['M', left.plotX, left.plotY, right.plotX, right.plotY],
            nextLastPoint = right,
            pointRadius = 25,
            arrowLength = 5,
            arrowWidth = 5;

          if (left.plotY < right.plotY) {
            path.push(
              nextLastPoint.plotX - pointRadius * Math.sin(angle),
              nextLastPoint.plotY - pointRadius * Math.cos(angle)
            );
            path.push(
              nextLastPoint.plotX - pointRadius * Math.sin(angle) - arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle),
              nextLastPoint.plotY - pointRadius * Math.cos(angle) - arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle)
            );
            path.push(
              nextLastPoint.plotX - pointRadius * Math.sin(angle),
              nextLastPoint.plotY - pointRadius * Math.cos(angle)
            );
            path.push(
              nextLastPoint.plotX - pointRadius * Math.sin(angle) - arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle),
              nextLastPoint.plotY - pointRadius * Math.cos(angle) - arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle)
            );
          } else {
            path.push(
              nextLastPoint.plotX + pointRadius * Math.sin(angle),
              nextLastPoint.plotY + pointRadius * Math.cos(angle)
            );
            path.push(
              nextLastPoint.plotX + pointRadius * Math.sin(angle) + arrowLength * Math.sin(angle) - arrowWidth * Math.cos(angle),
              nextLastPoint.plotY + pointRadius * Math.cos(angle) + arrowLength * Math.cos(angle) + arrowWidth * Math.sin(angle)
            );
            path.push(
              nextLastPoint.plotX + pointRadius * Math.sin(angle),
              nextLastPoint.plotY + pointRadius * Math.cos(angle)
            );
            path.push(
              nextLastPoint.plotX + pointRadius * Math.sin(angle) + arrowLength * Math.sin(angle) + arrowWidth * Math.cos(angle),
              nextLastPoint.plotY + pointRadius * Math.cos(angle) + arrowLength * Math.cos(angle) - arrowWidth * Math.sin(angle)
            );
          }

          return path;
        }
        return [
          ['M', left.plotX || 0, left.plotY || 0],
          ['L', right.plotX || 0, right.plotY || 0],
        ];
      });
    }(Highcharts));
  }, []);

  // Handle file selection and parsing CSV files
  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setUploadStatus('');
    const newFilesData = selectedFiles.map((file) => ({
      file,
      csvData: [],
      graphData: null,
      visualizeReady: false,
    }));

    selectedFiles.forEach((file, index) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result && result.data) {
            const updatedFilesData = [...newFilesData];
            updatedFilesData[index].csvData = result.data;
            setFilesData(updatedFilesData);
          } else {
            console.error('CSV data could not be parsed.');
          }
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
        },
      });
    });
  };

  // Handle uploading files to the server
  const handleUpload = async () => {
    if (filesData.length === 0) {
      setUploadStatus('Please select at least one file.');
      return;
    }

    const promises = filesData.map(async ({ file }, index) => {
      const formData = new FormData();
      formData.append('csvFile', file);

      try {
        const response = await fetch('http://localhost:5000/upload', { method: 'POST', body: formData });
        const data = await response.json();
        return { success: response.ok, message: data.message, count: data.count || 0, index };
      } catch (error) {
        return { success: false, message: 'File upload failed.', index };
      }
    });

    const results = await Promise.all(promises);
    const successfulUploads = results.filter(res => res.success);
    const failedUploads = results.filter(res => !res.success);

    if (successfulUploads.length > 0) {
      setUploadStatus(`${successfulUploads.length} files uploaded successfully.`);
      const updatedFilesData = filesData.map((fileData, index) => ({
        ...fileData,
        visualizeReady: successfulUploads.some(upload => upload.index === index),
      }));
      setFilesData(updatedFilesData);
    }

    if (failedUploads.length > 0) {
      setUploadStatus(failedUploads.map(res => res.message).join(' '));
    }
  };

  // Fetch graph data from the server
  const fetchGraphData = async (fileIndex) => {
    try {
      const response = await fetch('http://localhost:5000/networkdata');
      if (!response.ok) throw new Error('Failed to fetch graph data.');
      const data = await response.json();
      const updatedFilesData = [...filesData];
      updatedFilesData[fileIndex].graphData = data;
      setFilesData(updatedFilesData);
    } catch (error) {
      setUploadStatus('An error occurred while fetching graph data.');
    }
  };

  // Handle visualizing the graph
  const handleVisualize = async (fileIndex) => {
    await fetchGraphData(fileIndex);
  };

  // Handle deleting files from the list
  const handleDelete = (fileIndex) => {
    const updatedFilesData = filesData.filter((_, index) => index !== fileIndex);
    setFilesData(updatedFilesData);
  };

  // Generate Highcharts graph options with arrows
  const generateGraphOptions = (data) => {
    const nodesMap = {};
    const links = data.map(item => {
      if (!nodesMap[item.from]) {
        nodesMap[item.from] = { id: item.from, marker: { radius: 20, fillColor: '#90ee90' } };
      }
      if (!nodesMap[item.to]) {
        nodesMap[item.to] = { id: item.to, marker: { radius: 20, fillColor: '#90ee90' } };
      }

      nodesMap[item.from].marker.radius += 1;
      nodesMap[item.to].marker.radius += 1;

      return { from: item.from, to: item.to, width: item.strength || 1 };
    });

    const nodes = Object.values(nodesMap);

    return {
      chart: {
        type: 'networkgraph',
        height: '400px',
      },
      title: {
        text: 'Dynamic Network Graph',
      },
      plotOptions: {
        networkgraph: {
          keys: ['from', 'to'],
          layoutAlgorithm: {
            enableSimulation: true,
          },
          dataLabels: {
            enabled: true,
            linkFormat: '',
            allowOverlap: false,
            align: 'center',
            verticalAlign: 'middle',
            style: {
              textOutline: 'none',
              color: 'white',
            },
            formatter: function () {
              return this.point.id;
            },
          },
          arrow: {
            enabled: true,
            width: 1,
            color: '#ff0000',
            size: 5,
          },
        },
      },
      series: [{
        data: links,
        nodes: nodes,
      }],
    };
  };

  // Render CSV data as a table
  const renderCsvTable = (csvData) => {
    if (!csvData || csvData.length === 0) return null;

    const headers = Object.keys(csvData[0]);

    return (
      <table className="csv-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {csvData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => (
                <td key={colIndex}>{row[header]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Upload Multiple CSVs to Visualize Dynamic Network Graph</h1>
        <input type="file" accept=".csv" multiple onChange={handleFileChange} />
        <button onClick={handleUpload}>Upload</button>
        {uploadStatus && <p>{uploadStatus}</p>}
      </header>
      <div className="file-container">
        {filesData.map((fileData, index) => (
          <div key={index} className="file-data">
            <h3>{fileData.file.name}</h3>
            {renderCsvTable(fileData.csvData)}
            {fileData.visualizeReady && (
              <div>
                <button onClick={() => handleVisualize(index)}>Visualize Graph</button>
                {fileData.graphData && (
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={generateGraphOptions(fileData.graphData)}
                  />
                )}
              </div>
            )}
            <button onClick={() => handleDelete(index)}>Delete File</button>
          </div>
        ))}
      </div>
      <footer>
        <p>© 2024 Hash Agile. All Rights Reserved.</p>
      </footer>
    </div>
  );
}

export default App;
