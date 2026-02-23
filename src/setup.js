export class CompanionSetup {
    constructor(onComplete) {
        this.onComplete = onComplete;
        this.personality = null;
        this.details = "";
        this.questions = [
            {
                id: "personality",
                text: "나의 여행 동반자는 어떤 성격이었으면 좋겠어?",
                options: [
                    { text: "친절하고 다정한", value: "kind" },
                    { text: "열정 넘치는 전문가", value: "expert" },
                    { text: "유머러스하고 장난기 많은", value: "funny" },
                    { text: "차분하고 지적인", value: "calm" }
                ]
            }
        ];

        this.init();
    }

    init() {
        this.overlay = document.getElementById('setup-overlay');
        this.optionsContainer = document.getElementById('setup-options');
        this.questionText = document.getElementById('question-text');
        this.inputContainer = document.getElementById('setup-input-container');
        this.loadingContainer = document.getElementById('setup-loading');
        this.finishButton = document.getElementById('setup-finish-button');
        this.detailInput = document.getElementById('setup-detail-input');

        this.renderOptions();

        this.finishButton.addEventListener('click', () => {
            this.details = this.detailInput.value;
            this.finishSetup();
        });
    }

    renderOptions() {
        const q = this.questions[0];
        this.questionText.textContent = q.text;
        this.optionsContainer.innerHTML = '';

        q.options.forEach(opt => {
            const card = document.createElement('div');
            card.className = 'option-card';
            card.textContent = opt.text;
            card.onclick = () => {
                this.personality = opt.value;
                this.showInput();
            };
            this.optionsContainer.appendChild(card);
        });
    }

    showInput() {
        document.getElementById('setup-question-container').classList.add('hidden');
        this.inputContainer.classList.remove('hidden');
    }

    async finishSetup() {
        this.inputContainer.classList.add('hidden');
        this.loadingContainer.classList.remove('hidden');
        document.getElementById('setup-title').textContent = "컴패니온 생성 중...";

        // This data will be used to customize Gemini persona
        const companionData = {
            personality: this.personality,
            details: this.details
        };

        // Callback to main to generate avatar and start app
        if (this.onComplete) {
            await this.onComplete(companionData);
        }

        this.overlay.classList.add('hidden');
    }
}
