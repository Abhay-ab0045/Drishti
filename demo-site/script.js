// Photo upload preview
const photoInput = document.getElementById('photo-upload');
const photoPreview = document.getElementById('photo-preview');
const photoPlaceholder = document.getElementById('photo-placeholder');

if (photoInput) {
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (photoPreview) {
          photoPreview.src = event.target.result;
          photoPreview.style.display = 'block';
        }
        if (photoPlaceholder) {
          photoPlaceholder.style.display = 'none';
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

// Fill sample data button
const fillBtn = document.getElementById('fill-sample-data');
if (fillBtn) {
  fillBtn.addEventListener('click', () => {
    const fields = {
      'full_name': 'Rajesh Kumar Sharma',
      'dob': '1990-05-15',
      'gender': 'male',
      'email': 'rajesh.sharma@email.com',
      'mobile': '+91 98765 43210',
      'aadhaar_number': '1234 5678 9012',
      'pan_number': 'ABCPS1234D',
      'address': '42, Sector 15,\nChandigarh, 160015'
    };
    
    for (const [name, value] of Object.entries(fields)) {
      const el = document.querySelector(`[name="${name}"]`);
      if (el) {
        el.value = value;
        // Trigger input event so any listeners fire
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Create a simple sample face image on canvas for face detection testing
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw a simple face placeholder
      ctx.fillStyle = '#f5deb3';
      ctx.fillRect(0, 0, 150, 180);
      // Head
      ctx.beginPath();
      ctx.arc(75, 70, 45, 0, Math.PI * 2);
      ctx.fillStyle = '#deb887';
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(60, 60, 4, 0, Math.PI * 2);
      ctx.arc(90, 60, 4, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      ctx.beginPath();
      ctx.arc(75, 80, 12, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      // Body
      ctx.fillStyle = '#4a90d9';
      ctx.fillRect(35, 115, 80, 65);
      
      const dataUrl = canvas.toDataURL('image/png');
      if (photoPreview) {
        photoPreview.src = dataUrl;
        photoPreview.style.display = 'block';
      }
      if (photoPlaceholder) {
        photoPlaceholder.style.display = 'none';
      }
    }
    
    console.log('[Demo] Sample data filled');
  });
}

// Form submission handler (prevent actual submission)
const form = document.getElementById('application-form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('This is a demo form. No data has been submitted.\n\nIn a real scenario, Drishti would have detected and redacted the sensitive fields before any network transmission.');
  });
}
