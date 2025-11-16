import { useState } from "react";

function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    industry: "",
    useCase: "",
    companySize: "",
  });
  const industries = [
    "Telecommunications",
    "Financial Services",
    "Media & Entertainment",
    "Government",
    "Retail",
  ];
  const useCases = ["Customer C360", "Marketing", "Data Management"];
  const companySizes = ["<50", "51-500", "500-2000", "2000+"];

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Here you would handle registration logic
    alert("Registration submitted!");
  }

  return (
    <div className="register-page">
      <h2>Free Trial Registration</h2>
      <p className="register-info">
        It's a free trial. We will share the link for the registered user within
        14 working days.
      </p>
      <form className="register-form" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Company Email
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Industry
          <select
            name="industry"
            value={form.industry}
            onChange={handleChange}
            required
          >
            <option value="">Select Industry</option>
            {industries.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label>
          Use Case
          <select
            name="useCase"
            value={form.useCase}
            onChange={handleChange}
            required
          >
            <option value="">Select Use Case</option>
            {useCases.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label>
          Company Size
          <select
            name="companySize"
            value={form.companySize}
            onChange={handleChange}
            required
          >
            <option value="">Select Company Size</option>
            {companySizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="hero-btn primary">
          Register
        </button>
      </form>
    </div>
  );
}

export default RegisterPage;
