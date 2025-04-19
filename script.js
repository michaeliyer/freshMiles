function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

let audioContext;
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioContext initialized successfully");
    } catch (e) {
      console.error("Error initializing AudioContext:", e);
    }
  }
}

function drawVisualizer(canvas, analyser) {
  const ctx = canvas.getContext("2d");
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = canvas.width / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = `rgb(${dataArray[i] + 100}, 50, 50)`;
      ctx.fillRect(
        i * barWidth,
        canvas.height - barHeight,
        barWidth - 1,
        barHeight
      );
    }

    canvas._animationFrame = requestAnimationFrame(draw);
  }

  draw();
}

const isiOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Macintosh") && "ontouchend" in document);

// Store all album configurations
const albumConfigs = {
  1: audioSources, // config_1.js
  2: audioSources2, // config_2.js
  3: audioSources3, // config_3.js
  4: audioSources4, // config_3.js
};

// Function to create a new track element
function createTrackElement(trackId, trackData) {
  const template = document.getElementById("track-template");
  const trackElement = template.content.cloneNode(true);

  // Set up the track element
  const track = trackElement.querySelector(".track");
  const title = trackElement.querySelector(".track-title");
  const audio = trackElement.querySelector("audio");
  const playButton = trackElement.querySelector(".play-button");
  const seekBar = trackElement.querySelector(".seek-bar");
  const volumeSlider = trackElement.querySelector(".volume-slider");
  const timeDisplay = trackElement.querySelector(".time-display");
  const canvas = trackElement.querySelector(".visualizer");
  const repeatInput = trackElement.querySelector(".track-repeat-count");

  // Set IDs and data attributes
  audio.id = `audio${trackId}`;
  title.id = `track-title-${trackId}`;
  playButton.setAttribute("data-audio", `audio${trackId}`);
  seekBar.setAttribute("data-seek", `audio${trackId}`);
  volumeSlider.setAttribute("data-volume", `audio${trackId}`);
  canvas.setAttribute("data-visualizer", `audio${trackId}`);
  repeatInput.setAttribute("data-repeat", `audio${trackId}`);

  // Set initial content
  title.textContent = trackData.title;
  const source = audio.querySelector("source");
  source.src = trackData.url;

  return track;
}

// Function to update audio sources for all tracks
function updateAudioSources(albumNumber) {
  const config = albumConfigs[albumNumber];
  if (!config) return;

  // Update background video
  const video = document.getElementById("background-video");
  const videoSource = video.querySelector("source");
  if (config.backgroundVideo) {
    videoSource.src = config.backgroundVideo.url;
    videoSource.type = config.backgroundVideo.type;
    video.load();
  }

  // Clear existing tracks
  const tracksContainer = document.getElementById("tracks-container");
  tracksContainer.innerHTML = "";

  // Create new tracks based on the album configuration
  let trackCount = 0;
  for (const key in config) {
    if (key.startsWith("audio")) {
      trackCount++;
      const trackElement = createTrackElement(trackCount, config[key]);
      tracksContainer.appendChild(trackElement);
    }
  }

  // Initialize all the new tracks
  initializeTracks();
}

// Function to initialize all tracks
function initializeTracks() {
  let currentTrack = null;
  let repeatCounts = new Map(); // Track repeat counts for each audio element

  document.querySelectorAll("button[data-audio]").forEach((button) => {
    const audioId = button.getAttribute("data-audio");
    const audio = document.getElementById(audioId);
    const seekBar = document.querySelector(`input[data-seek="${audioId}"]`);
    const volumeSlider = document.querySelector(
      `input[data-volume="${audioId}"]`
    );
    const timeDisplay = button.parentElement.querySelector(".time-display");
    const canvas = document.querySelector(
      `canvas[data-visualizer="${audioId}"]`
    );
    const trackTitle = document.getElementById(
      `track-title-${audioId.replace("audio", "")}`
    );
    const repeatInput = document.querySelector(
      `input[data-repeat="${audioId}"]`
    );

    // Initialize repeat count for this track
    if (!repeatCounts.has(audioId)) {
      repeatCounts.set(audioId, 0);
    }

    // Update repeat count when user changes the input
    repeatInput.addEventListener("change", () => {
      const newCount = parseInt(repeatInput.value) || 0;
      repeatCounts.set(audioId, newCount); // Set to the new count
    });

    // Initialize with current value
    repeatCounts.set(audioId, parseInt(repeatInput.value) || 0);

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    audio.addEventListener("loadedmetadata", () => {
      console.log("Audio metadata loaded:", {
        duration: audio.duration,
        readyState: audio.readyState,
        error: audio.error,
        src: audio.currentSrc,
      });
      timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
    });

    audio.addEventListener("error", (e) => {
      console.error("Audio error:", e);
      console.error("Audio error details:", audio.error);
      console.error("Audio source:", audio.currentSrc);
    });

    audio.addEventListener("canplay", () => {
      console.log("Audio can play now");
    });

    audio.addEventListener("stalled", () => {
      console.error("Audio stalled - buffering");
    });

    button.addEventListener("click", async () => {
      try {
        initAudioContext();

        // If this is a different track than the current one, reset repeat count
        if (currentTrack !== audioId) {
          repeatCounts.set(audioId, parseInt(repeatInput.value) || 0);
          currentTrack = audioId;
        }

        document.querySelectorAll("audio").forEach((other) => {
          if (other !== audio) {
            other.pause();
            const otherBtn = document.querySelector(
              `button[data-audio="${other.id}"]`
            );
            if (otherBtn) otherBtn.textContent = "▶️";
            const otherCanvas = document.querySelector(
              `canvas[data-visualizer="${other.id}"]`
            );
            if (otherCanvas) cancelAnimationFrame(otherCanvas._animationFrame);
          }
        });

        if (!audio._visualizerInitialized) {
          try {
            const source = audioContext.createMediaElementSource(audio);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            drawVisualizer(canvas, analyser);
            audio._source = source;
            audio._analyser = analyser;
            audio._visualizerInitialized = true;
            console.log("Visualizer initialized successfully");
          } catch (e) {
            console.error("Error initializing visualizer:", e);
          }
        }

        if (audio.paused) {
          try {
            await audio.play();
            button.textContent = "⏸️";
            console.log("Audio playback started");
            if (audio._analyser) {
              drawVisualizer(canvas, audio._analyser);
            }
          } catch (e) {
            console.error("Error starting playback:", e);
            button.textContent = "❌";
          }
        } else {
          audio.pause();
          button.textContent = "▶️";
          cancelAnimationFrame(canvas._animationFrame);
        }
      } catch (err) {
        console.error(`Playback error for ${audioId}:`, err);
        button.textContent = "❌";
      }
    });

    audio.addEventListener("timeupdate", () => {
      if (!isNaN(audio.duration)) {
        seekBar.value = audio.currentTime;
        seekBar.max = audio.duration;
        timeDisplay.textContent = `${formatTime(
          audio.currentTime
        )} / ${formatTime(audio.duration)}`;
      }
    });

    seekBar.addEventListener("input", () => {
      audio.currentTime = seekBar.value;
      timeDisplay.textContent = `${formatTime(
        audio.currentTime
      )} / ${formatTime(audio.duration)}`;
    });

    if (!isiOS) {
      volumeSlider.addEventListener("input", () => {
        audio.volume = volumeSlider.value;
      });
    } else {
      volumeSlider.style.display = "none";
      const notice = document.createElement("div");
      notice.className = "ios-volume-note";
      notice.textContent = "Use your device's volume buttons on iOS.";
      volumeSlider.parentElement.appendChild(notice);
    }

    audio.addEventListener("ended", () => {
      const currentRepeatCount = repeatCounts.get(audioId) || 0;

      if (currentRepeatCount > 0) {
        // Decrement repeat count and play again
        const newCount = currentRepeatCount - 1;
        repeatCounts.set(audioId, newCount);
        repeatInput.value = newCount; // Update the UI input value
        audio.currentTime = 0;
        audio.play();
      } else {
        // Move to next track
        button.textContent = "▶️";
        cancelAnimationFrame(canvas._animationFrame);
        const initialRepeatCount = parseInt(repeatInput.value) || 0;
        repeatCounts.set(audioId, initialRepeatCount);
        repeatInput.value = initialRepeatCount; // Reset the UI input value

        // Get all tracks in the current album
        const tracks = Array.from(document.querySelectorAll("audio")).sort(
          (a, b) => {
            return (
              parseInt(a.id.replace("audio", "")) -
              parseInt(b.id.replace("audio", ""))
            );
          }
        );

        // Find the current track's index
        const currentIndex = tracks.findIndex((track) => track.id === audioId);

        // Determine the next track
        let nextTrack;
        if (currentIndex === tracks.length - 1) {
          // If this is the last track, go back to the first track
          nextTrack = tracks[0];
        } else {
          // Otherwise, go to the next track
          nextTrack = tracks[currentIndex + 1];
        }

        // Play the next track
        if (nextTrack) {
          const nextButton = document.querySelector(
            `button[data-audio="${nextTrack.id}"]`
          );
          if (nextButton) {
            console.log(`Auto-playing next track: ${nextTrack.id}`);
            setTimeout(() => {
              nextButton.click();
            }, 100);
          }
        }
      }
    });
  });
}

// Add event listener for album selection
document.getElementById("album-select").addEventListener("change", (e) => {
  const selectedAlbum = parseInt(e.target.value);
  updateAudioSources(selectedAlbum);
});

// Initialize with first album
updateAudioSources(1);
