// Init on load
window.addEventListener('load', () => {
  if (window.emailjs) {
    emailjs.init("7OE6vi87x-b2N1UbM"); // Replace with your EmailJS public key
    console.log("✅ EmailJS initialized");
  } else {
    console.error("❌ EmailJS SDK not available");
  }

  main();
});

const video = document.getElementById('video');
const status = document.getElementById('status');

// Register known faces here
const knownFaces = [
  { name: 'Bhuvana', imgPath: 'students/Bhuvana.jpg' },
  { name: 'Vyshu', imgPath: 'students/Vyshu.jpg' },
  // Add more students here
];

async function loadModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('./model/tiny_face_detector_model');
    await faceapi.nets.faceLandmark68Net.loadFromUri('./model/face_landmark_68_model');
    await faceapi.nets.faceRecognitionNet.loadFromUri('./model/face_recognition_model');
    console.log("✅ Models loaded");
  } catch (err) {
    console.error("❌ Model loading failed:", err);
    status.textContent = 'Failed to load models: ' + err.message;
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
      video.play();
      console.log("✅ video.play() triggered");
    };

    console.log("✅ Camera stream assigned to video element");
  } catch (error) {
    console.error('❌ Error accessing webcam:', error.message);
    status.textContent = 'Camera access error: ' + error.message;
  }
}

async function loadLabeledImages() {
  const labeledDescriptors = [];

  for (const student of knownFaces) {
    const img = await faceapi.fetchImage(student.imgPath);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.warn(`⚠️ No face detected in ${student.name}'s image.`);
      continue;
    }

    labeledDescriptors.push(
      new faceapi.LabeledFaceDescriptors(student.name, [detection.descriptor])
    );
  }

  return labeledDescriptors;
}

function sendUnknownFaceAlert() {
  const templateParams = {
    name:'Dean',
    to_name: 'Dean',
    from_name: 'FACE RECOGNITION SYSTEM',
    message: 'Unknown face detected at ' + new Date().toLocaleString(),
    email: 'pujitha.24bce8319@vitapstudent.ac.in' // Replace if needed
  };

  console.log("📧 Sending unknown face alert...");

  emailjs.send('service_qe78uqj', 'template_i9ghmqg', templateParams)
    .then(function(response) {
      console.log('✅ Email sent to dean successfully!', response.status, response.text);
    }, function(error) {
      console.error('❌ Failed to send email:', error);
    });
}
async function runFaceDetection() {
  console.log("🧠 Starting face detection loop");
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  const labeledDescriptors = await loadLabeledImages();
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
  status.textContent = 'Detecting faces...';

  let lastLabel = '';
  let lastUnknownSentTime = 0;  // Track last email time
  const cooldownDuration = 60 * 1000; // 1 minute cooldown in ms

  setInterval(async () => {
    const now = Date.now();

    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map(d =>
      faceMatcher.findBestMatch(d.descriptor)
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const box = resizedDetections[i].detection.box;

      new faceapi.draw.DrawBox(box, { label: result.toString() }).draw(canvas);

      if (result.label !== lastLabel) {
        if (result.label === 'unknown') {
          status.textContent = '❌ Unknown face detected';

          // Check cooldown based on timestamp
          if (now - lastUnknownSentTime > cooldownDuration) {
            sendUnknownFaceAlert();
            lastUnknownSentTime = now;
            console.log("🕒 Sent unknown alert email, cooldown started");
          } else {
            console.log("⏳ Cooldown active, not sending email");
          }

        } else {
          status.textContent = `✅ Welcome, ${result.label}`;
        }
        lastLabel = result.label;
      }
    }
  }, 1000);
}

async function main() {
  await loadModels();
  status.textContent = 'Models loaded. Starting camera...';

  await startCamera();

  // Start detection only when video plays
  video.addEventListener('playing', () => {
    console.log("✅ Video is playing, starting face detection");
    runFaceDetection();
  });
}