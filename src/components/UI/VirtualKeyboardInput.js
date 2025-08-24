import React, { useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

const VirtualKeyboardInput = ({input, setInput}) => {
    // const [input, setInput] = useState("");
    const [showKeyboard, setShowKeyboard] = useState(false);

    const handleChange = (event) => {
        setInput(event.target.value);
    };

    const onKeyPress = (button) => {
        if (button === "{bksp}") {
            setInput(input.slice(0, -1)); // Remove last character
        } else if (button === "{space}") {
            setInput(input + " "); // Add space
        } else if (button === "{enter}") {
            setShowKeyboard(false); // Hide keyboard on enter
        } else {
            setInput(input + button);
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
            {/* Input Field */}
            <input
                type="password"
                value={input}
                 onChange={handleChange} 
                style={{ width: "100%", fontSize: "12px", padding: "10px" }}
            /> 
        </div>
    );
};

export default VirtualKeyboardInput;
