export class SnapshotManager {
    constructor(panorama) {
        this.panorama = panorama;
        this.button = document.getElementById('snapshot-button');
        this.photoInput = document.getElementById('user-photo-input');
    }

    init(onCapture) {
        this.button.addEventListener('click', () => {
            this.photoInput.click();
        });

        this.photoInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                // In a real app, we'd process the file and the panorama screenshot here.
                // For this task, we'll notify the user to use the 'generate_image' tool manually 
                // OR explain that the AI takes care of it.
                if (onCapture) onCapture(file);
            }
        });
    }
}
