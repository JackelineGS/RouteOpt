#include <iostream>
#include <iterator>
#include <string>

#include <nlohmann/json.hpp>

#include "instance.hpp"
#include "solve.hpp"

using json = nlohmann::json;

static json error_response(const std::string& code, const std::string& message) {
    return {{"status", "error"}, {"error", {{"code", code}, {"message", message}}}};
}

static json handle_generate(const json& req) {
    const int n = req.at("n").get<int>();
    const unsigned seed = req.value("seed", 42u);
    const json area = req.value("area", json::object());
    const double lat_min = area.value("lat_min", -12.15);
    const double lat_max = area.value("lat_max", -11.95);
    const double lon_min = area.value("lon_min", -77.12);
    const double lon_max = area.value("lon_max", -76.95);

    Instance inst = generate_instance(n, seed, lat_min, lat_max, lon_min, lon_max);
    return {{"status", "ok"}, {"instance", instance_to_json(inst)}};
}

int main() {
    const std::string input((std::istreambuf_iterator<char>(std::cin)),
                            std::istreambuf_iterator<char>());
    json response;
    try {
        const json req = json::parse(input);
        const std::string mode = req.at("mode").get<std::string>();
        if (mode == "ping") {
            response = {{"status", "ok"}, {"engine", "routeopt-engine"}, {"version", "0.2.0"}};
        } else if (mode == "generate") {
            response = handle_generate(req);
        } else if (mode == "solve") {
            response = handle_solve(req);
        } else {
            response = error_response("UNKNOWN_MODE", "Modo no soportado: " + mode);
        }
    } catch (const EngineError& e) {
        response = error_response(e.code, e.what());
    } catch (const json::exception& e) {
        response = error_response("INVALID_REQUEST", e.what());
    } catch (const std::exception& e) {
        response = error_response("INTERNAL_ERROR", e.what());
    }
    std::cout << response.dump() << std::endl;
    return 0;
}

