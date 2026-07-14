import React from "react";

const permissions = ["View", "Create", "Edit", "Delete"];

const getRoleKey = (role = {}) => role.id || role.key || role.roleName || role.name;

function PermissionMatrix({ roles = [], onToggle, updatingKey = "" }) {
  return (
    <div className="sa-permission-matrix">
      <div className="sa-permission-head">
        <span>Role</span>
        {permissions.map((permission) => (
          <span key={permission}>{permission}</span>
        ))}
      </div>

      {roles.map((role) => {
        const roleKey = getRoleKey(role);

        return (
          <div className="sa-permission-row" key={roleKey}>
            <b>{role.name}</b>
            {permissions.map((permission) => (
              <label key={permission} className="sa-checkbox">
                <input
                  type="checkbox"
                  checked={permission === "View" || (role.permissions || []).includes(permission)}
                  disabled={
                    permission === "View" ||
                    !roleKey ||
                    updatingKey === `${roleKey}:${permission}`
                  }
                  onChange={() => onToggle?.(role, permission)}
                />
                <span>{permission}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default PermissionMatrix;

