export function showAlert(message) {
    const alertEl = document.getElementById("customAlert");
    const alertMsg = document.getElementById("alertMessage");
    const closeBtn = document.getElementById("alertClose");

    alertMsg.textContent = message;
    alertEl.classList.remove("hidden");

    closeBtn.onclick = () => {
        alertEl.classList.add("hidden");
    };
}