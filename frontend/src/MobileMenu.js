import { useState} from "react";
import { NavLink} from "react-router-dom";
import { useNavigate } from "react-router-dom";

const MobileMenu = ({ id }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 rounded bg-blue-600 text-white">
        ☰
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white border shadow rounded z-50">
          <NavLink to={`/plant/${id}/inverters`} className="block px-4 py-2 hover:bg-gray-100" onClick={() => setOpen(false)}>Inverters</NavLink>
          <button onClick={handleLogout} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600">
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileMenu;
