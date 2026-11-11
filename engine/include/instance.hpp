#pragma once
#include <stdexcept>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

struct EngineError : std::runtime_error {
    std::string code;
    EngineError(std::string c, const std::string& msg)
        : std::runtime_error(msg), code(std::move(c)) {}
};

struct Node {
    int id;
    std::string name;
    double lat;
    double lon;
};

struct Instance {
    std::string id;
    std::vector<Node> nodes;                  // nodes[0] es el depósito
    std::string distance_source;              // "haversine" o "matrix"
    std::vector<std::vector<double>> matrix;  // n x n, en metros
};

double haversine_m(double lat1, double lon1, double lat2, double lon2);

// Construye la matriz (haversine) o valida la recibida (matrix).
void prepare_matrix(Instance& inst);

Instance instance_from_json(const nlohmann::json& j);
nlohmann::json instance_to_json(const Instance& inst);

// n = total de nodos, incluyendo el depósito.
Instance generate_instance(int n, unsigned seed,
                           double lat_min, double lat_max,
                           double lon_min, double lon_max);
