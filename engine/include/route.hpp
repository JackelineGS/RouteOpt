#pragma once
#include <string>
#include <vector>

#include "types.hpp"

// Una ruta válida empieza en 0 y contiene cada nodo 0..n-1 exactamente una vez.
// Si no es válida, devuelve false y explica el motivo en `why`.
bool validate_route(const std::vector<int>& route, size_t n, std::string& why);

// Suma las distancias entre nodos consecutivos e incluye el arco de regreso
// al depósito (RF-06).
double route_cost(const Matrix& d, const std::vector<int>& route);

