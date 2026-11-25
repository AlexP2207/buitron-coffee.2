const express = require("express");
const router = express.Router();
const db = require("../config/db");
const jwt = require("jsonwebtoken");

// Middleware para verificar token
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ message: "Token requerido" });
  }
  
  jwt.verify(token, "secreto123", (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token inválido" });
    }

    db.query(
      "SELECT ID_Rol FROM usuario WHERE ID_Usuario = ?",
      [decoded.id],
      (errRole, result) => {
        if (errRole) {
          return res.status(500).json({ message: "Error al verificar permisos" });
        }
        if (!result.length || Number(result[0].ID_Rol) !== 1) {
          return res.status(403).json({ message: "No tienes permisos de administrador" });
        }
        req.usuarioId = decoded.id;
        next();
      }
    );
  });
};

const validarProducto = (body) => {
  const nombre = typeof body.Nombre_producto === "string" ? body.Nombre_producto.trim() : "";
  const categoria = typeof body.Categoria === "string" ? body.Categoria.trim() : "";
  const precio = Number(body.Precio);
  const stock = Number(body.Stock);

  if (!nombre || !categoria) return "Nombre y categoría son obligatorios";
  if (!Number.isFinite(precio) || precio <= 0) return "El precio debe ser mayor a 0";
  if (!Number.isInteger(stock) || stock < 0) return "El stock debe ser un entero mayor o igual a 0";

  return null;
};

// 🟢 OBTENER TODOS LOS PRODUCTOS (para admin - incluye inhabilitados)
router.get("/", (req, res) => {
  const sql = `
    SELECT p.*, 
           u.Nombre_usuario as Nombre_Proveedor, 
           u.Apellido as Apellido_Proveedor,
           p.calificacion_promedio,
           p.total_resenas
    FROM producto p
    LEFT JOIN usuario u ON p.ID_Proveedor = u.ID_Usuario
    ORDER BY p.ID_Producto DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// 🟢 OBTENER PRODUCTOS ACTIVOS (para el catálogo público)
router.get("/activos", (req, res) => {
  const sql = `
    SELECT p.*, 
           u.Nombre_usuario as Nombre_Proveedor,
           p.calificacion_promedio,
           p.total_resenas
    FROM producto p
    LEFT JOIN usuario u ON p.ID_Proveedor = u.ID_Usuario
    WHERE p.Estado = 1
    ORDER BY p.ID_Producto DESC
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// 🟢 OBTENER UN PRODUCTO POR ID
router.get("/:id", (req, res) => {
  const id = req.params.id;
  
  db.query(
    "SELECT * FROM producto WHERE ID_Producto = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      if (results.length === 0) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      res.json(results[0]);
    }
  );
});

// 🟢 CREAR NUEVO PRODUCTO
router.post("/", verificarToken, (req, res) => {
  const { Nombre_producto, Descripcion, Categoria, Precio, Stock, imagen, ID_Proveedor } = req.body;

  const errorValidacion = validarProducto(req.body);
  if (errorValidacion) {
    return res.status(400).json({ message: errorValidacion });
  }
  
  const sql = `
    INSERT INTO producto (Nombre_producto, Descripcion, Categoria, Precio, Stock, imagen, Estado, ID_Proveedor)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `;
  
  db.query(
    sql,
    [Nombre_producto.trim(), Descripcion?.trim() || null, Categoria.trim(), Number(Precio), Number(Stock), imagen?.trim() || null, ID_Proveedor || null],
    (err, result) => {
      if (err) {
        console.error("Error al crear producto:", err);
        return res.status(500).json({ message: "Error al crear producto" });
      }
      
      res.status(201).json({ 
        message: "Producto creado correctamente",
        id: result.insertId 
      });
    }
  );
});

// 🟡 ACTUALIZAR PRODUCTO
router.put("/:id", verificarToken, (req, res) => {
  const id = req.params.id;
  const { Nombre_producto, Descripcion, Categoria, Precio, Stock, imagen, ID_Proveedor } = req.body;

  const errorValidacion = validarProducto(req.body);
  if (errorValidacion) {
    return res.status(400).json({ message: errorValidacion });
  }
  
  const sql = `
    UPDATE producto 
    SET Nombre_producto = ?, Descripcion = ?, Categoria = ?, Precio = ?, Stock = ?, imagen = ?, ID_Proveedor = ?
    WHERE ID_Producto = ?
  `;
  
  db.query(
    sql,
    [Nombre_producto.trim(), Descripcion?.trim() || null, Categoria.trim(), Number(Precio), Number(Stock), imagen?.trim() || null, ID_Proveedor || null, id],
    (err, result) => {
      if (err) {
        console.error("Error al actualizar producto:", err);
        return res.status(500).json({ message: "Error al actualizar producto" });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      res.json({ message: "Producto actualizado correctamente" });
    }
  );
});

// 🟠 INHABILITAR PRODUCTO
router.patch("/:id/inhabilitar", verificarToken, (req, res) => {
  const id = req.params.id;
  
  const sql = "UPDATE producto SET Estado = 0 WHERE ID_Producto = ?";
  
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error al inhabilitar producto:", err);
      return res.status(500).json({ message: "Error al inhabilitar producto" });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    res.json({ message: "Producto inhabilitado correctamente" });
  });
});

// 🟢 HABILITAR PRODUCTO
router.patch("/:id/habilitar", verificarToken, (req, res) => {
  const id = req.params.id;
  
  const sql = "UPDATE producto SET Estado = 1 WHERE ID_Producto = ?";
  
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error al habilitar producto:", err);
      return res.status(500).json({ message: "Error al habilitar producto" });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    
    res.json({ message: "Producto habilitado correctamente" });
  });
});

// 🔴 ELIMINAR PRODUCTO
router.delete("/:id", (req, res) => {
  const id = req.params.id;
  
  db.query(
    "DELETE FROM producto WHERE ID_Producto = ?",
    [id],
    (err, result) => {
      if (err) {
        console.error("Error al eliminar producto:", err);
        return res.status(500).json({ message: "Error al eliminar producto" });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Producto no encontrado" });
      }
      
      res.json({ message: "Producto eliminado correctamente" });
    }
  );
});

router.get("/buscar/:texto", (req, res) => {
  const texto = req.params.texto;

  db.query(
    "SELECT * FROM producto WHERE Nombre_producto LIKE ?",
    [`%${texto}%`],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

module.exports = router;